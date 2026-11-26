"""Isolated real-App report UI checks. TEST_BASE_URL defaults to no-auth Vite :5199.
Optional TEST_REPORT_WORKSPACE loads a private local snapshot for archive checks.
All external network requests are blocked. No production writes or emails.
"""
from pathlib import Path
import json
import os
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5199')
OUT = Path(os.environ.get('TEST_REPORT_SCREENSHOTS', os.environ.get('TEMP', '/tmp'))) / 'creatorops-report-tabs'
OUT.mkdir(parents=True, exist_ok=True)
now = datetime.now(timezone.utc)
history = [{'measuredAt': (now - timedelta(days=days)).isoformat(), 'views': views, 'likes': 10, 'comments': 2, 'shares': 1, 'saves': 2} for days, views in [(2, 500), (1, 1000)]]
fixture = {
    'brands': [{'id': 101, 'name': '리포트 검증 브랜드'}], 'activeBrandId': 101,
    'creators': [{'id': 301, 'name': '검증 크리에이터', 'handle': '@report_fixture', 'platform': 'YouTube', 'country': 'KR', 'followers': 15000, 'topics': [], 'tags': []}],
    'campaigns': [{'id': 201, 'brandId': 101, 'name': '리포트 검증 캠페인', 'creatorIds': [301], 'actualSpend': 5000, 'actualRevenue': 10000, 'contentFormats': ['숏폼']}, {'id': 202, 'brandId': 101, 'name': '빈 기록 캠페인', 'creatorIds': [], 'contentFormats': ['숏폼', '스토리']}],
    'trackedPosts': [{'id': 401, 'campaignId': 201, 'creatorId': 301, 'title': '검증 업로드 콘텐츠', 'platform': 'YouTube', 'views': 1000, 'likes': 10, 'comments': 2, 'shares': 1, 'saves': 2, 'contentFormat': '숏폼', 'metricHistory': history, 'sourceCollectedAtIso': now.isoformat()}],
    'fulfillmentRecords': [{'id': 501, 'campaignId': 201, 'creatorId': 301, 'paymentAmount': 5000}],
    'creatorOperations': [], 'creatorGroups': [], 'activities': [], 'outreach': [],
    'conversionEvents': [{'id': 601, 'campaignId': 201, 'eventType': 'purchase', 'eventValue': 10000, 'orderId': 'fixture-order'}],
    'utmTrackingLogs': [], 'shortLinkClickLogs': [], 'orderAttributionLogs': [],
}
tabs = ['종합 요약', '인플루언서별', '콘텐츠별', '유입·구매', '분석·다음 전략']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1050})
    context.route('https://**/*', lambda route: route.abort())
    page = context.new_page()
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script('localStorage.setItem("creatorops.workspace.v2", ' + json.dumps(json.dumps(fixture)) + ')')
    page.goto(BASE)
    page.get_by_role('button', name='리포트', exact=True).click()
    for label in tabs:
        page.get_by_role('tab', name=label, exact=True).click()
        assert page.get_by_role('tab', name=label, exact=True).get_attribute('aria-selected') == 'true'
        assert page.get_by_role('tabpanel', name=label, exact=True).is_visible()
        assert page.locator('.campaign-report-tab-panel').count() == 1
        if label == '인플루언서별':
            assert page.get_by_role('heading', name='비용 효율', exact=True).is_visible()
            assert page.get_by_role('heading', name='등급별 비교', exact=True).is_visible()
            assert page.get_by_role('heading', name='콘텐츠 형식별 비교', exact=True).is_visible()
            assert '5원' in page.get_by_role('region', name='인플루언서별 기록 비용 대비 효율').inner_text()
            page.screenshot(path=str(OUT / 'creators-desktop.png'), full_page=True)
        if label == '콘텐츠별':
            assert page.get_by_text('검증 업로드 콘텐츠', exact=True).is_visible()
            page.get_by_text('개별 영상 추이 · 2회 관측', exact=True).click()
            assert page.get_by_role('img', name='조회수 500에서 1,000까지 변화').is_visible()
        if label == '유입·구매':
            assert '10,000원' in page.get_by_role('tabpanel', name=label).inner_text()
    page.get_by_role('button', name='캠페인 전략·가이드 열기', exact=True).click()
    assert page.get_by_role('tab', name='전략·가이드', exact=True).get_attribute('aria-selected') == 'true'
    page.get_by_role('button', name='리포트', exact=True).click()
    page.get_by_role('tab', name='유입·구매', exact=True).click()
    page.get_by_role('button', name='캠페인 링크·추적 설정', exact=True).click()
    assert page.get_by_role('tab', name='링크·추적', exact=True).get_attribute('aria-selected') == 'true'
    page.get_by_role('button', name='리포트', exact=True).click()
    page.get_by_label('리포트 캠페인', exact=True).select_option('202')
    page.get_by_role('tab', name='콘텐츠별', exact=True).click()
    assert page.get_by_text('검증 업로드 콘텐츠', exact=True).count() == 0
    assert '미확인' in page.get_by_role('tabpanel', name='콘텐츠별').inner_text()
    page.get_by_label('리포트 캠페인', exact=True).select_option('201')
    page.get_by_role('tab', name='종합 요약', exact=True).click()
    page.get_by_role('tab', name='종합 요약', exact=True).press('ArrowRight')
    assert page.get_by_role('tab', name='인플루언서별', exact=True).get_attribute('aria-selected') == 'true'
    page.set_viewport_size({'width': 390, 'height': 844})
    for label in tabs:
        page.get_by_role('tab', name=label, exact=True).click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label + ' overflow'
    page.get_by_role('tab', name='인플루언서별', exact=True).click()
    page.screenshot(path=str(OUT / 'creators-mobile.png'), full_page=True)
    assert not errors, errors
    print(json.dumps({'synthetic': 'five tabs, financial metrics, content history, campaign isolation, keyboard, links, mobile passed', 'pageErrors': errors}, ensure_ascii=True))
    context.close()
    if os.environ.get('TEST_REPORT_WORKSPACE'):
        workspace = json.loads(Path(os.environ['TEST_REPORT_WORKSPACE']).read_text(encoding='utf-8'))
        context = browser.new_context(viewport={'width': 1440, 'height': 1050})
        context.route('https://**/*', lambda route: route.abort())
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script('localStorage.setItem("creatorops.workspace.v2", ' + json.dumps(json.dumps(workspace)) + ')')
        page.goto(BASE)
        page.get_by_role('combobox', name='관리 브랜드', exact=True).select_option(label='몽클로스')
        page.get_by_role('button', name='리포트', exact=True).click()
        page.get_by_label('리포트 캠페인', exact=True).select_option('4626478425614440')
        for label in tabs:
            page.get_by_role('tab', name=label, exact=True).click()
            assert page.get_by_role('tabpanel', name=label, exact=True).is_visible()
        page.get_by_role('tab', name='인플루언서별', exact=True).click()
        assert page.get_by_role('region', name='선택 캠페인 인플루언서 42명 비교').is_visible()
        page.screenshot(path=str(OUT / 'monclos-creators.png'), full_page=True)
        page.get_by_role('tab', name='콘텐츠별', exact=True).click()
        assert page.locator('.content-performance-row').count() == 1
        original_post = next(post for post in workspace['trackedPosts'] if str(post.get('campaignId')) == '4626478425614440')
        assert f"{original_post['likes']:,}" in page.get_by_role('tabpanel', name='콘텐츠별').inner_text()
        assert '미확인' in page.get_by_role('tabpanel', name='콘텐츠별').inner_text()
        page.screenshot(path=str(OUT / 'monclos-content.png'), full_page=True)
        assert not errors, errors
        print(json.dumps({'monclosArchive': 'five tabs, 42 creators, one actual content, source likes and unknown metrics preserved', 'pageErrors': errors}, ensure_ascii=True))
        context.close()
    browser.close()
