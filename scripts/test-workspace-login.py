"""Run against Vite with fake Supabase env (see docs/workspace-login-check.md).

Every auth/data request is intercepted; never connects to a real database.
"""
import base64
import json
import os
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5198')
USER_ID = '00000000-0000-4000-8000-000000000001'
USER = {'id': USER_ID, 'email': 'owner@example.test', 'aud': 'authenticated', 'role': 'authenticated'}
MEMBER = {'workspace_id': 'test-workspace', 'user_id': USER_ID, 'role': 'Owner', 'status': 'active'}
STAMP = '2026-11-25T00:00:00Z'
WORKSPACE = {
    'brands': [{'id': 101, 'name': '공유 테스트 브랜드'}], 'activeBrandId': 101,
    'campaigns': [{'id': 201, 'brandId': 101, 'name': '공유 캠페인', 'status': 'Live', 'creatorIds': []}],
    'creators': [{'id': 301, 'name': '공유 테스트 크리에이터', 'handle': '@fixture_creator', 'platform': 'YouTube', 'country': 'KR', 'followers': 15000, 'topics': [], 'tags': []}],
    'creatorGroups': [{'id': 'shared-group', 'brandId': 101, 'name': '공유 후보 그룹', 'creatorIds': [301]}],
    'activities': [], 'outreach': [],
}


def token():
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    return enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({**USER, 'sub': USER_ID, 'exp': int(time.time()) + 3600}) + '.fixture'


def run_case(browser, name, authenticated=False, denied=False, failed=False, empty=False):
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    errors, writes = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    if authenticated:
        session = {'access_token': token(), 'refresh_token': 'fixture-refresh', 'expires_at': int(time.time()) + 3600, 'expires_in': 3600, 'token_type': 'bearer', 'user': USER}
        context.add_init_script('localStorage.setItem("sb-workspace-test-auth-token", ' + json.dumps(json.dumps(session)) + ')')

    def handle(route):
        request = route.request
        path = urlparse(request.url).path
        headers = {'access-control-allow-origin': '*', 'content-type': 'application/json'}
        if request.method == 'OPTIONS':
            route.fulfill(status=200, headers={**headers, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}, body='')
            return
        if request.method not in ['GET', 'HEAD']:
            writes.append(path)
            route.fulfill(status=200, headers=headers, body='[]')
            return
        if path.endswith('/user'):
            data = USER
        elif path.endswith('/workspace_members'):
            if failed:
                route.fulfill(status=503, headers=headers, body=json.dumps({'message': 'fixture database unavailable'}))
                return
            data = [] if denied else [MEMBER]
            if 'application/vnd.pgrst.object' in request.headers.get('accept', ''):
                data = None if denied else MEMBER
        elif path.endswith('/workspace_snapshots'):
            data = {'workspace_id': 'test-workspace', 'payload': {**WORKSPACE, 'creatorGroups': [] if empty else WORKSPACE['creatorGroups']}, 'updated_at': STAMP}
        elif path.endswith('/brand_scoped_snapshots'):
            data = [{'brand_id': 101, 'payload': {'brand': WORKSPACE['brands'][0], 'campaigns': WORKSPACE['campaigns'], 'creatorGroups': [] if empty else WORKSPACE['creatorGroups'], 'creators': WORKSPACE['creators']}, 'updated_at': STAMP}]
        else:
            data = []
        route.fulfill(status=200, headers=headers, body=json.dumps(data))

    context.route('https://workspace-test.supabase.co/**', handle)
    page.goto(BASE)
    if not authenticated:
        page.get_by_role('heading', name='로그인', exact=True).wait_for()
        assert page.locator('.brand-switcher').count() == 0
        assert page.get_by_text('스킨케어 D2C 브랜드', exact=True).count() == 0
        assert not writes
    elif denied or failed:
        page.get_by_role('heading', name='공유 데이터를 불러오지 못했습니다').wait_for()
        assert page.locator('.brand-switcher').count() == 0
        assert page.get_by_role('button', name='다시 불러오기').is_visible()
        assert not writes
    else:
        try:
            page.locator('.brand-switcher select').wait_for(timeout=10000)
        except Exception:
            print(json.dumps({'errors': errors, 'screen': page.locator('body').inner_text()}, ensure_ascii=True))
            raise
        assert page.locator('.brand-switcher select').input_value() == '101'
        page.get_by_role('button', name='후보 그룹', exact=True).click()
        if empty:
            page.get_by_role('heading', name='후보 그룹 0개', exact=True).wait_for()
            assert page.locator('.creator-group-card').count() == 0
        else:
            page.locator('.creator-group-card').filter(has_text='공유 후보 그룹').wait_for(timeout=10000)
        assert page.get_by_text('뷰티_KR_우선 제안', exact=True).count() == 0
        page.reload()
        page.locator('.brand-switcher select').wait_for()
        assert page.locator('.brand-switcher select').input_value() == '101'
    assert not errors, errors
    print(json.dumps({'case': name, 'result': 'passed', 'pageErrors': errors}, ensure_ascii=True))
    context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    run_case(browser, 'signed-out')
    run_case(browser, 'active-member', authenticated=True)
    run_case(browser, 'non-member', authenticated=True, denied=True)
    run_case(browser, 'database-failure', authenticated=True, failed=True)
    run_case(browser, 'empty-groups-stay-empty', authenticated=True, empty=True)
    browser.close()
