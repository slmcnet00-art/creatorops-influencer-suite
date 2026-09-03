import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Check,
  Database,
  ExternalLink,
  FileSearch,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Video,
} from 'lucide-react'
import './YouTubeApiReview.css'

const API_BASE_URL = String(import.meta.env.VITE_CREATOROPS_API_BASE_URL || 'http://localhost:8787')
  .replace(/\/$/, '')

const DEFAULT_VIDEO_URL = 'https://www.youtube.com/watch?v=Z3irEyS3_PY'
const REVIEW_SNAPSHOT_KEY = 'creatorops.youtubeReviewSnapshot.v1'

const formatNumber = (value) => {
  if (value === null || value === undefined) return 'Hidden by channel owner'
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

const workflowSteps = [
  {
    number: '01',
    icon: Search,
    title: 'Discover relevant public content',
    api: 'youtube.search.list',
    detail: 'CreatorOps searches public YouTube videos and channels using campaign keywords, region and language criteria.',
  },
  {
    number: '02',
    icon: Users,
    title: 'Verify creator channels',
    api: 'youtube.channels.list',
    detail: 'We retrieve public channel identity and aggregate statistics to evaluate creator relevance and reach.',
  },
  {
    number: '03',
    icon: Video,
    title: 'Read public video performance',
    api: 'youtube.videos.list',
    detail: 'We retrieve public titles, publication dates, thumbnails and engagement counters for campaign evaluation.',
  },
  {
    number: '04',
    icon: BarChart3,
    title: 'Use data in campaign operations',
    api: 'CreatorOps workflow',
    detail: 'Authorized team members compare creators, create shortlists and monitor public campaign content performance.',
  },
]

function ResultMetric({ label, value }) {
  return (
    <div className="yt-review-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  )
}

export default function YouTubeApiReview() {
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO_URL)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runDemo = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/compliance-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'The live YouTube API request failed.')
      setResult(payload.data)
      window.sessionStorage.setItem(REVIEW_SNAPSHOT_KEY, JSON.stringify(payload.data))
    } catch (requestError) {
      setError(requestError.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="yt-review-page">
      <header className="yt-review-nav">
        <a className="yt-review-brand" href="/youtube-api-review" aria-label="CreatorOps review home">
          <span className="yt-review-brandmark"><Video size={21} /></span>
          <span>CreatorOps</span>
        </a>
        <nav aria-label="Review page navigation">
          <a href="#workflow">API workflow</a>
          <a href="#live-demo">Live demonstration</a>
          <a href="#data-controls">Data controls</a>
        </nav>
        <span className="yt-review-chip"><ShieldCheck size={15} /> Compliance review</span>
      </header>

      <section className="yt-review-hero">
        <div className="yt-review-hero-copy">
          <p className="yt-review-eyebrow">YOUTUBE DATA API SERVICES</p>
          <h1>How CreatorOps uses the YouTube Data API</h1>
          <p>
            CreatorOps helps authorized marketing teams discover public creator channels, evaluate public video
            performance and monitor campaign content. This page provides a step-by-step English demonstration of
            the live API client for YouTube API Services compliance review.
          </p>
          <div className="yt-review-hero-actions">
            <a className="yt-review-primary" href="#live-demo"><Play size={17} /> Run live demonstration</a>
            <a className="yt-review-secondary" href="#workflow">Review API workflow <ArrowRight size={16} /></a>
          </div>
        </div>
        <div className="yt-review-hero-panel" aria-label="API usage summary">
          <div className="yt-review-panel-heading">
            <Video size={25} />
            <div>
              <span>Live API client</span>
              <strong>Public YouTube data only</strong>
            </div>
          </div>
          <div className="yt-review-call-row"><Check size={16} /> Keyword and regional discovery</div>
          <div className="yt-review-call-row"><Check size={16} /> Channel identity and public statistics</div>
          <div className="yt-review-call-row"><Check size={16} /> Video metadata and public engagement</div>
          <div className="yt-review-call-row"><Check size={16} /> Refresh and deletion controls</div>
          <p>No private videos, account passwords or non-public audience data are collected.</p>
        </div>
      </section>

      <section className="yt-review-section" id="workflow">
        <div className="yt-review-section-heading">
          <div>
            <p className="yt-review-eyebrow">STEP-BY-STEP VISUAL REFERENCE</p>
            <h2>YouTube API workflow</h2>
          </div>
          <span>Search → Verify → Measure → Operate</span>
        </div>
        <div className="yt-review-steps">
          {workflowSteps.map((step) => {
            const Icon = step.icon
            return (
              <article key={step.number} className="yt-review-step">
                <div className="yt-review-step-top">
                  <span>{step.number}</span>
                  <Icon size={20} />
                </div>
                <h3>{step.title}</h3>
                <code>{step.api}</code>
                <p>{step.detail}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="yt-review-section yt-review-demo" id="live-demo">
        <div className="yt-review-section-heading">
          <div>
            <p className="yt-review-eyebrow">LIVE API CLIENT</p>
            <h2>Public video and channel verification</h2>
          </div>
          <span className="yt-review-live"><i /> Calls the production API server</span>
        </div>

        <div className="yt-review-demo-grid">
          <div className="yt-review-demo-control">
            <div className="yt-review-control-icon"><FileSearch size={23} /></div>
            <h3>1. Enter a public YouTube video URL</h3>
            <p>The server extracts the video ID and requests only the documented public resource parts.</p>
            <label htmlFor="youtube-review-url">Public YouTube video URL</label>
            <div className="yt-review-input-row">
              <input
                id="youtube-review-url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                spellCheck="false"
              />
              <button type="button" onClick={runDemo} disabled={loading}>
                {loading ? <LoaderCircle className="yt-review-spinner" size={18} /> : <Play size={18} />}
                {loading ? 'Requesting…' : 'Run live request'}
              </button>
            </div>
            <div className="yt-review-request-map">
              <div><span>Request A</span><code>videos.list</code><small>snippet, statistics, contentDetails</small></div>
              <ArrowRight size={18} />
              <div><span>Request B</span><code>channels.list</code><small>snippet, statistics</small></div>
            </div>
            {error && (
              <div className="yt-review-error">
                <strong>Live request status</strong>
                <span>{error}</span>
                <small>If the daily quota is exhausted, this transparent error demonstrates why additional production quota is required.</small>
              </div>
            )}
          </div>

          <div className={`yt-review-result ${result ? 'has-result' : ''}`}>
            {!result ? (
              <div className="yt-review-result-empty">
                <Database size={28} />
                <strong>2. API response appears here</strong>
                <p>Run the request to display the exact public fields returned by YouTube Data API v3.</p>
              </div>
            ) : (
              <>
                <div className="yt-review-result-status"><Check size={16} /> Live response received</div>
                <div className="yt-review-video-summary">
                  <a
                    className="yt-review-thumbnail-link"
                    href={result.video.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open the original YouTube video: ${result.video.title}`}
                  >
                    <img src={result.video.thumbnail} alt="YouTube video thumbnail returned by the API" />
                    <span className="yt-review-thumbnail-play" aria-hidden="true"><Play size={22} /></span>
                  </a>
                  <div>
                    <span>VIDEO RESOURCE</span>
                    <h3>{result.video.title}</h3>
                    <p>{result.video.channelTitle} · {result.video.publishedAt?.slice(0, 10)}</p>
                    <a className="yt-review-original-link" href={result.video.url} target="_blank" rel="noreferrer">
                      Open original video on YouTube <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                <div className="yt-review-metrics">
                  <ResultMetric label="Views" value={result.video.views} />
                  <ResultMetric label="Likes" value={result.video.likes} />
                  <ResultMetric label="Comments" value={result.video.comments} />
                </div>
                <div className="yt-review-channel-summary">
                  <img src={result.channel.thumbnail} alt="YouTube channel thumbnail returned by the API" />
                  <div><span>CHANNEL RESOURCE</span><strong>{result.channel.title}</strong><small>{result.channel.id}</small></div>
                  <div className="yt-review-channel-stats">
                    <b>{formatNumber(result.channel.subscribers)}</b><span>subscribers</span>
                    <b>{formatNumber(result.channel.videos)}</b><span>videos</span>
                  </div>
                </div>
                <div className="yt-review-call-list">
                  {result.calls.map((call) => (
                    <div key={call.method}><Check size={14} /><code>{call.method}</code><span>{call.status}</span></div>
                  ))}
                </div>
                <p className="yt-review-timestamp">Verified at {new Date(result.checkedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="yt-review-section" id="data-controls">
        <div className="yt-review-section-heading">
          <div>
            <p className="yt-review-eyebrow">DATA GOVERNANCE</p>
            <h2>Storage, refresh and deletion controls</h2>
          </div>
        </div>
        <div className="yt-review-controls">
          <article><RefreshCw size={20} /><div><h3>Refresh</h3><p>Authorized users can request a fresh API snapshot. The latest collection time and source are recorded.</p></div></article>
          <article><Database size={20} /><div><h3>30-day retention control</h3><p>Non-Authorized public YouTube API Data is refreshed or deleted within 30 calendar days. Stale values are not displayed until they are collected again.</p></div></article>
          <article><Trash2 size={20} /><div><h3>Deletion</h3><p>Authorized workspace administrators can remove stored creators, content records and associated workflow data.</p></div></article>
          <article><ShieldCheck size={20} /><div><h3>Access control</h3><p>Workspace and brand roles determine which authorized team members can view or manage the collected data.</p></div></article>
          <article><FileSearch size={20} /><div><h3>User input and exports</h3><p>Search terms and public URLs are used only for read-only retrieval. YouTube API search results cannot be bulk-downloaded or exported to Google Sheets.</p></div></article>
        </div>
      </section>

      <footer className="yt-review-footer">
        <div>
          <strong>CreatorOps</strong>
          <span>YouTube API Services compliance review reference</span>
          <span>By using CreatorOps Influencer Suite, users agree to be bound by the YouTube Terms of Service.</span>
        </div>
        <div>
          <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy <ExternalLink size={13} /></a>
          <a href="/terms" target="_blank" rel="noreferrer">Terms of Service <ExternalLink size={13} /></a>
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service <ExternalLink size={13} /></a>
        </div>
      </footer>
    </main>
  )
}
