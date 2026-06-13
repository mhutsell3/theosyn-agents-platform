'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Account {
  id: string
  page_name: string
  platform: string
  active: boolean
  posts_this_week: number
  likes_this_week: number
  comments_this_week: number
  reach_this_week: number
}

interface RecentPost {
  id: string
  title: string
  channel: string
  page_name: string
  status: string
  posted_at: string
  error: string | null
  platform_post_id: string | null
  likes: number
  comments: number
  reach: number
}

interface DuePost {
  id: string
  title: string
  channel: string
  scheduled_date: string
  draft_content: string
}

interface Props {
  accounts: Account[]
  recentPosts: RecentPost[]
  duePosts: DuePost[]
  lastHeartbeat: { content: string; created_at: string } | null
}

type Tab = 'overview' | 'posts' | 'comments' | 'flags' | 'report'

interface Comment {
  id: string
  post_title: string
  page_name: string
  platform: string
  from_name: string | null
  message: string
  reply_draft: string | null
  reply_status: string
  is_simple: boolean
  is_question: boolean
  is_negative: boolean
  fetched_at: string
  replied_at: string | null
}

interface Flag {
  id: string
  post_title: string | null
  page_name: string
  platform: string
  flag_type: string
  message: string
  created_at: string
}

const platformColor: Record<string, string> = {
  Facebook:  'text-blue-400',
  Instagram: 'text-pink-400',
  LinkedIn:  'text-sky-400',
  X:         'text-zinc-300',
}

export default function PulseDashboard({ accounts, recentPosts, duePosts, lastHeartbeat }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState<{ posted: number; message?: string; results: { title: string; status: string; error?: string }[] } | null>(null)
  const [runningHeartbeat, setRunningHeartbeat] = useState(false)
  const [freshReport, setFreshReport] = useState<string | null>(null)

  const [comments, setComments] = useState<Comment[]>([])
  const [flags, setFlags] = useState<Flag[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [fetchingComments, setFetchingComments] = useState(false)
  const [editingReply, setEditingReply] = useState<string | null>(null)
  const [editedText, setEditedText] = useState('')
  const [sendingReply, setSendingReply] = useState<string | null>(null)

  useEffect(() => {
    loadComments()
    loadFlags()
  }, [])

  async function loadComments() {
    setLoadingComments(true)
    const res = await fetch('/api/pulse/comments')
    const data = await res.json()
    setComments(data.comments ?? [])
    setLoadingComments(false)
  }

  async function loadFlags() {
    const res = await fetch('/api/pulse/flags')
    const data = await res.json()
    setFlags(data.flags ?? [])
  }

  async function fetchNow() {
    setFetchingComments(true)
    await fetch('/api/pulse/fetch-comments', { method: 'POST' })
    await loadComments()
    await loadFlags()
    setFetchingComments(false)
  }

  async function sendReply(comment: Comment, text?: string) {
    setSendingReply(comment.id)
    const res = await fetch('/api/pulse/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: comment.id, editedReply: text }),
    })
    if (res.ok) {
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, reply_status: 'sent' } : c))
      setEditingReply(null)
    }
    setSendingReply(null)
  }

  async function dismissComment(commentId: string) {
    await fetch('/api/pulse/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, action: 'dismiss' }),
    })
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  async function resolveFlag(flagId: string) {
    await fetch('/api/pulse/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagId }),
    })
    setFlags(prev => prev.filter(f => f.id !== flagId))
  }

  const totalReach = accounts.reduce((s, a) => s + Number(a.reach_this_week), 0)
  const totalLikes = accounts.reduce((s, a) => s + Number(a.likes_this_week), 0)
  const totalPosts = accounts.reduce((s, a) => s + Number(a.posts_this_week), 0)

  async function postNow() {
    setPosting(true)
    setPostResult(null)
    const res = await fetch('/api/pulse/post-now', { method: 'POST' })
    const data = await res.json()
    setPostResult(data)
    setPosting(false)
    router.refresh()
  }

  async function runHeartbeat() {
    setRunningHeartbeat(true)
    const res = await fetch('/api/pulse/heartbeat', { method: 'POST' })
    const data = await res.json()
    setFreshReport(data.report ?? null)
    setRunningHeartbeat(false)
    setTab('report')
    router.refresh()
  }

  const reportContent = freshReport ?? lastHeartbeat?.content ?? null
  const reportDate = lastHeartbeat?.created_at
    ? new Date(lastHeartbeat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📡</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Pulse</h1>
            <p className="text-zinc-500 text-sm">Social Media Agent — organic posting, scheduling, engagement</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={runHeartbeat}
            disabled={runningHeartbeat}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {runningHeartbeat ? '💓 Generating...' : '💓 Weekly Report'}
          </button>
          <button
            onClick={postNow}
            disabled={posting || duePosts.length === 0}
            className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {posting ? '📤 Posting...' : `📤 Post Now${duePosts.length > 0 ? ` (${duePosts.length} due)` : ''}`}
          </button>
        </div>
      </div>

      {/* Post result */}
      {postResult && (
        <div className={`border rounded-xl px-5 py-3 ${postResult.posted > 0 ? 'bg-emerald-950 border-emerald-700' : 'bg-zinc-900 border-zinc-700'}`}>
          <p className={`text-sm font-semibold ${postResult.posted > 0 ? 'text-emerald-300' : 'text-zinc-400'}`}>
            {postResult.posted > 0 ? `✓ ${postResult.posted} post${postResult.posted !== 1 ? 's' : ''} published` : postResult.message ?? 'No posts due'}
          </p>
          {postResult.results?.filter(r => r.status === 'failed').map((r, i) => (
            <p key={i} className="text-red-400 text-xs mt-1">✗ {r.title}: {r.error}</p>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pages',        value: accounts.length,  color: 'text-white' },
          { label: 'Posts (7d)',   value: totalPosts,       color: 'text-indigo-400' },
          { label: 'Likes (7d)',   value: totalLikes,       color: 'text-pink-400' },
          { label: 'Reach (7d)',   value: totalReach.toLocaleString(), color: 'text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-zinc-500 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex-wrap">
        {([
          ['overview',  'Overview'],
          ['posts',     'Post History'],
          ['comments',  'Comments'],
          ['flags',     'Flags'],
          ['report',    'Weekly Report'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {label}
            {t === 'overview' && duePosts.length > 0 && (
              <span className="ml-2 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{duePosts.length}</span>
            )}
            {t === 'comments' && comments.filter(c => c.reply_status === 'pending').length > 0 && (
              <span className="ml-2 bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {comments.filter(c => c.reply_status === 'pending').length}
              </span>
            )}
            {t === 'flags' && flags.length > 0 && (
              <span className="ml-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{flags.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          {/* Connected pages */}
          <div>
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-3">Connected Pages</p>
            {accounts.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <p className="text-zinc-500 text-sm">No pages connected. Add one in Settings → Social Media.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {accounts.map(account => (
                  <div key={account.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-medium">{account.page_name}</p>
                        <p className={`text-xs ${platformColor[account.platform] ?? 'text-zinc-400'}`}>{account.platform}</p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-center flex-shrink-0">
                      <div>
                        <p className="text-white text-sm font-mono font-bold">{account.posts_this_week}</p>
                        <p className="text-zinc-600 text-xs">posts</p>
                      </div>
                      <div>
                        <p className="text-pink-400 text-sm font-mono font-bold">{account.likes_this_week}</p>
                        <p className="text-zinc-600 text-xs">likes</p>
                      </div>
                      <div>
                        <p className="text-emerald-400 text-sm font-mono font-bold">{Number(account.reach_this_week).toLocaleString()}</p>
                        <p className="text-zinc-600 text-xs">reach</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Due posts queue */}
          {duePosts.length > 0 && (
            <div>
              <p className="text-amber-400 text-xs font-mono uppercase tracking-widest mb-3">⏰ {duePosts.length} Post{duePosts.length !== 1 ? 's' : ''} Due</p>
              <div className="flex flex-col gap-2">
                {duePosts.map(post => (
                  <div key={post.id} className="bg-zinc-900 border border-amber-800/40 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-white text-sm font-medium">{post.title}</p>
                      <span className="text-zinc-500 text-xs">{post.channel} · {new Date(post.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <p className="text-zinc-500 text-xs line-clamp-2">{post.draft_content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post History tab */}
      {tab === 'posts' && (
        <div className="flex flex-col gap-2">
          {recentPosts.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">No posts yet.</p>
            </div>
          ) : (
            recentPosts.map(post => (
              <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-medium">{post.title}</p>
                      <span className={`text-xs ${platformColor[post.channel] ?? 'text-zinc-400'}`}>{post.channel}</span>
                      <span className="text-zinc-600 text-xs">{post.page_name}</span>
                    </div>
                    {post.posted_at && (
                      <p className="text-zinc-600 text-xs mt-0.5">
                        {new Date(post.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {post.error && <p className="text-red-400 text-xs mt-1">{post.error}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${post.status === 'posted' ? 'text-emerald-400 bg-emerald-950' : post.status === 'failed' ? 'text-red-400 bg-red-950' : 'text-zinc-400 bg-zinc-800'}`}>
                      {post.status}
                    </span>
                    {post.status === 'posted' && (
                      <div className="flex gap-3 text-xs text-zinc-500">
                        <span>❤️ {post.likes}</span>
                        <span>💬 {post.comments}</span>
                        <span>👁 {Number(post.reach).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Comments tab */}
      {tab === 'comments' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">
              {comments.filter(c => c.reply_status === 'pending').length} pending replies
            </p>
            <button
              onClick={fetchNow}
              disabled={fetchingComments}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              {fetchingComments ? '⏳ Fetching...' : '↻ Fetch Now'}
            </button>
          </div>

          {loadingComments ? (
            <p className="text-zinc-600 text-sm text-center py-8">Loading comments...</p>
          ) : comments.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">No comments yet. Click Fetch Now or wait for the next auto-fetch.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map(comment => (
                <div key={comment.id} className={`bg-zinc-900 border rounded-xl p-4 flex flex-col gap-3 ${
                  comment.is_negative ? 'border-red-800/50' : comment.is_question ? 'border-blue-800/50' : 'border-zinc-800'
                }`}>
                  {/* Comment */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-white text-sm font-medium">{comment.from_name ?? 'Unknown'}</p>
                        {comment.is_negative && <span className="text-red-400 text-xs bg-red-950 px-1.5 py-0.5 rounded">⚠ Negative</span>}
                        {comment.is_question && <span className="text-blue-400 text-xs bg-blue-950 px-1.5 py-0.5 rounded">? Question</span>}
                        {comment.is_simple && <span className="text-zinc-500 text-xs">Simple</span>}
                        <span className="text-zinc-600 text-xs">{comment.page_name} · {new Date(comment.fetched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-zinc-300 text-sm">"{comment.message}"</p>
                      <p className="text-zinc-600 text-xs mt-0.5">on: {comment.post_title}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      comment.reply_status === 'sent' ? 'text-emerald-400 bg-emerald-950' :
                      comment.reply_status === 'dismissed' ? 'text-zinc-600 bg-zinc-800' :
                      'text-amber-400 bg-amber-950'
                    }`}>
                      {comment.reply_status}
                    </span>
                  </div>

                  {/* Reply draft */}
                  {comment.reply_status !== 'sent' && comment.reply_status !== 'dismissed' && comment.reply_draft && (
                    <div className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                      <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Pulse draft reply</p>
                      {editingReply === comment.id ? (
                        <textarea
                          value={editedText}
                          onChange={e => setEditedText(e.target.value)}
                          rows={3}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500"
                        />
                      ) : (
                        <p className="text-zinc-300 text-sm">{comment.reply_draft}</p>
                      )}
                      <div className="flex gap-2">
                        {editingReply === comment.id ? (
                          <>
                            <button onClick={() => setEditingReply(null)} className="text-xs text-zinc-500 px-3 py-1.5 border border-zinc-600 rounded-lg">Cancel</button>
                            <button
                              onClick={() => sendReply(comment, editedText)}
                              disabled={sendingReply === comment.id}
                              className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                            >
                              {sendingReply === comment.id ? 'Sending...' : 'Send Edited Reply'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => sendReply(comment)}
                              disabled={sendingReply === comment.id}
                              className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                            >
                              {sendingReply === comment.id ? 'Sending...' : '✓ Send Reply'}
                            </button>
                            <button
                              onClick={() => { setEditingReply(comment.id); setEditedText(comment.reply_draft ?? '') }}
                              className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg"
                            >
                              Edit
                            </button>
                            <button onClick={() => dismissComment(comment.id)} className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-1.5 rounded-lg">Dismiss</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flags tab */}
      {tab === 'flags' && (
        <div className="flex flex-col gap-3">
          {flags.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-emerald-400 text-sm">✓ No active flags</p>
            </div>
          ) : (
            flags.map(flag => {
              const flagColors: Record<string, string> = {
                negative_comment: 'border-red-800/50 bg-red-950/20',
                question:         'border-blue-800/50 bg-blue-950/20',
                dead_post:        'border-zinc-700',
                spike:            'border-amber-800/50 bg-amber-950/20',
              }
              const flagIcons: Record<string, string> = {
                negative_comment: '⚠️',
                question:         '❓',
                dead_post:        '💀',
                spike:            '🚀',
              }
              return (
                <div key={flag.id} className={`border rounded-xl p-4 flex items-start gap-3 ${flagColors[flag.flag_type] ?? 'border-zinc-800 bg-zinc-900'}`}>
                  <span className="text-lg flex-shrink-0">{flagIcons[flag.flag_type] ?? '🚩'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{flag.message}</p>
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {flag.page_name} · {new Date(flag.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => resolveFlag(flag.id)}
                    className="text-xs text-zinc-600 hover:text-emerald-400 px-2 py-1.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    Resolve
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Weekly Report tab */}
      {tab === 'report' && (
        <div className="flex flex-col gap-3">
          {reportContent ? (
            <>
              <div className="flex items-center justify-between">
                {reportDate && !freshReport && <p className="text-zinc-600 text-xs">Last generated: {reportDate}</p>}
                {freshReport && <p className="text-emerald-400 text-xs">✓ Just generated</p>}
                <button
                  onClick={() => navigator.clipboard.writeText(reportContent)}
                  className="text-zinc-600 hover:text-indigo-400 text-xs transition-colors ml-auto"
                >
                  Copy ↗
                </button>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-h-[600px] overflow-y-auto">
                {reportContent.split('\n').map((line, i) => {
                  if (line.startsWith('# '))  return <h2 key={i} className="text-white text-lg font-bold mb-3 mt-1">{line.slice(2)}</h2>
                  if (line.startsWith('## ')) return <h3 key={i} className="text-white text-sm font-semibold mt-4 mb-1">{line.slice(3)}</h3>
                  if (line.startsWith('- '))  return <p key={i} className="text-zinc-300 text-sm ml-3">• {line.slice(2)}</p>
                  if (line.trim() === '')     return <div key={i} className="h-2" />
                  return <p key={i} className="text-zinc-300 text-sm leading-relaxed">{line}</p>
                })}
              </div>
            </>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">📡</span>
              <p className="text-zinc-400 text-sm">No weekly report yet.</p>
              <button
                onClick={runHeartbeat}
                disabled={runningHeartbeat}
                className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {runningHeartbeat ? 'Generating...' : 'Generate Now'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
