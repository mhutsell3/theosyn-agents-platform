const postgres = require('postgres')

async function migrate() {
  const db = process.env.DATABASE_URL
    ? postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })
    : postgres({
        host: 'localhost', port: 5432, database: 'theosyn',
        username: 'theosyn', password: 'T9$kL2!vQ7#m',
        ssl: false, max: 1,
      })

  try {
    // ── Multi-tenant core ─────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS organizations (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name       text NOT NULL,
        slug       text UNIQUE NOT NULL,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS users (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email           text UNIQUE NOT NULL,
        name            text,
        image           text,
        org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
        role            varchar(20) NOT NULL DEFAULT 'owner',
        is_system_admin boolean NOT NULL DEFAULT false,
        created_at      timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS org_settings (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        key        text NOT NULL,
        value      text NOT NULL,
        updated_at timestamptz DEFAULT now(),
        UNIQUE(org_id, key)
      )`

    // ── Agents & heartbeats ───────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS agents (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id         uuid REFERENCES organizations(id) ON DELETE CASCADE,
        name           text NOT NULL,
        persona        text NOT NULL DEFAULT '',
        role           text NOT NULL DEFAULT '',
        avatar_emoji   text NOT NULL DEFAULT '🤖',
        last_heartbeat timestamptz,
        created_at     timestamptz DEFAULT now(),
        enabled        boolean NOT NULL DEFAULT true,
        system_enabled boolean NOT NULL DEFAULT true,
        ollama_model   text,
        gemini_model   text,
        category       varchar(20) NOT NULL DEFAULT 'smb'
      )`

    await db`
      CREATE TABLE IF NOT EXISTS heartbeats (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id   uuid REFERENCES agents(id) ON DELETE CASCADE,
        content    text NOT NULL,
        tags       text[] DEFAULT '{}',
        created_at timestamptz DEFAULT now()
      )`

    // ── Clients & projects ────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS clients (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text NOT NULL,
        type          text NOT NULL DEFAULT 'Small Business',
        stage         text NOT NULL DEFAULT 'Discovery',
        contact_name  text,
        contact_email text,
        notes         text,
        created_at    timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS projects (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name       text NOT NULL,
        client_id  uuid REFERENCES clients(id) ON DELETE SET NULL,
        type       text NOT NULL DEFAULT 'AI Workflow Automation',
        phase      text NOT NULL DEFAULT 'Planning',
        due_date   date,
        notes      text,
        created_at timestamptz DEFAULT now()
      )`

    // ── Finance ───────────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS invoices (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
        client_name    text,
        amount         numeric(12,2) NOT NULL,
        status         text NOT NULL DEFAULT 'Draft',
        description    text,
        issue_date     date,
        due_date       date,
        invoice_number text,
        created_at     timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS expenses (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        description text NOT NULL,
        amount      numeric(12,2) NOT NULL,
        category    text,
        expense_date date,
        created_at  timestamptz DEFAULT now()
      )`

    // ── Calendar events ───────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS events (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title       text NOT NULL,
        event_date  date NOT NULL,
        event_time  text,
        type        text,
        notes       text,
        color       text,
        created_at  timestamptz DEFAULT now()
      )`

    // ── Content ───────────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS content_posts (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title         text NOT NULL,
        channel       text,
        status        text NOT NULL DEFAULT 'Draft',
        notes         text,
        draft_content text,
        scheduled_at  timestamptz,
        published_at  timestamptz,
        created_at    timestamptz DEFAULT now(),
        updated_at    timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS content_ideas (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title       text NOT NULL,
        description text,
        channel     text,
        status      text NOT NULL DEFAULT 'Idea',
        created_at  timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS content_variants (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        content_post_id uuid REFERENCES content_posts(id) ON DELETE CASCADE,
        channel         text,
        content         text,
        created_at      timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS nova_runs (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        content_post_id uuid REFERENCES content_posts(id) ON DELETE SET NULL,
        output          text,
        created_at      timestamptz DEFAULT now()
      )`

    // ── Social ────────────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        platform       text NOT NULL,
        account_name   text,
        page_id        text,
        access_token   text,
        token_expiry   timestamptz,
        enabled        boolean NOT NULL DEFAULT true,
        agent_name     text,
        created_at     timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS social_posts (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        content_post_id     uuid REFERENCES content_posts(id) ON DELETE CASCADE,
        social_account_id   uuid REFERENCES social_accounts(id) ON DELETE CASCADE,
        platform_post_id    text,
        status              text NOT NULL DEFAULT 'pending',
        error               text,
        posted_at           timestamptz,
        created_at          timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS social_engagement (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        social_post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,
        likes          int DEFAULT 0,
        comments       int DEFAULT 0,
        shares         int DEFAULT 0,
        reach          int DEFAULT 0,
        recorded_at    timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS social_comments (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        social_post_id uuid REFERENCES social_posts(id) ON DELETE CASCADE,
        platform_comment_id text,
        commenter_name text,
        content        text,
        sentiment      text,
        created_at     timestamptz DEFAULT now()
      )`

    // ── Scout (lead gen) ──────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS scout_leads (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name            text NOT NULL,
        category        text,
        address         text,
        phone           text,
        email           text,
        website         text,
        grade           text,
        notes           text,
        approval_status text NOT NULL DEFAULT 'pending',
        outreach_sent   boolean DEFAULT false,
        outreach_at     timestamptz,
        follow_up_sent  boolean DEFAULT false,
        follow_up_at    timestamptz,
        replied         boolean DEFAULT false,
        converted       boolean DEFAULT false,
        scraped_at      timestamptz DEFAULT now(),
        created_at      timestamptz DEFAULT now()
      )`

    // ── Piper (CRM) ───────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS contact_log (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
        type        text NOT NULL DEFAULT 'note',
        content     text NOT NULL,
        created_at  timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS piper_tasks (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
        request     text NOT NULL,
        status      text NOT NULL DEFAULT 'pending',
        created_at  timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS piper_approvals (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
        type        text,
        subject     text,
        body        text,
        status      text NOT NULL DEFAULT 'pending',
        sent_at     timestamptz,
        created_at  timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS piper_lead_inbox (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        scout_lead_id uuid REFERENCES scout_leads(id) ON DELETE CASCADE,
        content      text,
        created_at   timestamptz DEFAULT now()
      )`

    // ── Sage (research) ───────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS sage_briefs (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title       text NOT NULL,
        content     text,
        tags        text[] DEFAULT '{}',
        created_at  timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS sage_resources (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title       text NOT NULL,
        url         text,
        summary     text,
        tags        text[] DEFAULT '{}',
        created_at  timestamptz DEFAULT now()
      )`

    // ── Quill (brand voice) ───────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS brand_voice_samples (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source      text,
        source_id   text,
        content     text NOT NULL,
        subject     text,
        created_at  timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS brand_voice_profile (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        summary          text,
        sample_count     int DEFAULT 0,
        last_analyzed_at timestamptz,
        created_at       timestamptz DEFAULT now()
      )`

    // ── Theo sessions ─────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS theo_sessions (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trigger    text,
        mode       text,
        model      text,
        status     text NOT NULL DEFAULT 'running',
        created_at timestamptz DEFAULT now()
      )`

    // ── Remi (ad analytics) ───────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS remi_ad_accounts (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        platform     text NOT NULL,
        account_id   text NOT NULL,
        account_name text,
        access_token text,
        enabled      boolean NOT NULL DEFAULT true,
        created_at   timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS remi_snapshots (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id   text NOT NULL,
        account_name text,
        data         jsonb,
        created_at   timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS remi_adset_snapshots (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id   text NOT NULL,
        adset_id     text,
        adset_name   text,
        data         jsonb,
        created_at   timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS remi_ad_snapshots (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id text NOT NULL,
        ad_id      text,
        ad_name    text,
        data       jsonb,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS remi_recommendations (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id    text,
        account_name  text,
        campaign_id   text,
        campaign_name text,
        type          text,
        priority      text,
        reason        text,
        action_data   jsonb,
        status        text NOT NULL DEFAULT 'pending',
        created_at    timestamptz DEFAULT now()
      )`

    // ── Pulse ─────────────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS pulse_page_settings (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        social_account_id uuid REFERENCES social_accounts(id) ON DELETE CASCADE,
        enabled         boolean NOT NULL DEFAULT true,
        created_at      timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS pulse_flags (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        social_post_id      uuid REFERENCES social_posts(id) ON DELETE CASCADE,
        platform_comment_id text,
        reason              text,
        resolved            boolean DEFAULT false,
        created_at          timestamptz DEFAULT now()
      )`

    // ── Orion ─────────────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS orion_jobs (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        query      text NOT NULL,
        status     text NOT NULL DEFAULT 'running',
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS orion_competitors (
        id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id   uuid REFERENCES orion_jobs(id) ON DELETE CASCADE,
        name     text,
        data     jsonb,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS orion_pain_points (
        id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id   uuid REFERENCES orion_jobs(id) ON DELETE CASCADE,
        content  text,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS orion_reviews (
        id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id   uuid REFERENCES orion_jobs(id) ON DELETE CASCADE,
        content  text,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS orion_ad_matrix (
        id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id   uuid REFERENCES orion_jobs(id) ON DELETE CASCADE,
        data     jsonb,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS orion_hooks (
        id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id   uuid REFERENCES orion_jobs(id) ON DELETE CASCADE,
        content  text,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS orion_competitor_ads (
        id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id   uuid REFERENCES orion_jobs(id) ON DELETE CASCADE,
        data     jsonb,
        created_at timestamptz DEFAULT now()
      )`

    // ── Scribe ────────────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS scribe_topics (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title       text NOT NULL,
        description text,
        created_at  timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS scribe_research (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id   uuid REFERENCES scribe_topics(id) ON DELETE CASCADE,
        content    text,
        source     text,
        created_at timestamptz DEFAULT now()
      )`

    await db`
      CREATE TABLE IF NOT EXISTS scribe_materials (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id   uuid REFERENCES scribe_topics(id) ON DELETE CASCADE,
        title      text,
        content    text,
        type       text,
        created_at timestamptz DEFAULT now()
      )`

    // ── Beacon (education) ────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS students (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name           text NOT NULL,
        email          text UNIQUE NOT NULL,
        phone          text,
        purchase_level text,
        notes          text,
        ghl_contact_id text,
        welcome_sent   boolean DEFAULT false,
        enrolled_at    timestamptz DEFAULT now()
      )`

    // ── Token usage tracking ──────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS token_usage (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent            text,
        model            text,
        provider         text,
        prompt_tokens    int DEFAULT 0,
        completion_tokens int DEFAULT 0,
        total_tokens     int DEFAULT 0,
        created_at       timestamptz DEFAULT now()
      )`

    // ── Slack memory ──────────────────────────────────────────────────────────
    await db`
      CREATE TABLE IF NOT EXISTS slack_conversations (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id text NOT NULL,
        role       text NOT NULL,
        content    text NOT NULL,
        created_at timestamptz DEFAULT now()
      )`

    // ── Upgrade existing agents table columns ─────────────────────────────────
    await db`ALTER TABLE agents ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE`
    await db`ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_enabled boolean NOT NULL DEFAULT true`
    await db`ALTER TABLE users  ADD COLUMN IF NOT EXISTS is_system_admin boolean NOT NULL DEFAULT false`

    // ── Indexes ───────────────────────────────────────────────────────────────
    await db`CREATE INDEX IF NOT EXISTS heartbeats_agent_id_idx   ON heartbeats(agent_id)`
    await db`CREATE INDEX IF NOT EXISTS heartbeats_created_at_idx ON heartbeats(created_at DESC)`
    await db`CREATE INDEX IF NOT EXISTS agents_org_id_idx         ON agents(org_id)`
    await db`CREATE INDEX IF NOT EXISTS org_settings_org_id_idx   ON org_settings(org_id)`
    await db`CREATE INDEX IF NOT EXISTS scout_leads_status_idx    ON scout_leads(approval_status)`
    await db`CREATE INDEX IF NOT EXISTS content_posts_status_idx  ON content_posts(status)`
    await db`CREATE INDEX IF NOT EXISTS social_posts_cp_idx       ON social_posts(content_post_id)`

    console.log('Migration complete')
  } finally {
    await db.end()
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
