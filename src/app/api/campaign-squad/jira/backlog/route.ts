import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { CAMPAIGN_SQUAD_JIRA_EPIC_DESCRIPTION, CAMPAIGN_SQUAD_JIRA_EPIC_SUMMARY, CAMPAIGN_SQUAD_JIRA_STORIES } from '@/lib/campaign-squad/jira-backlog-template'
import { getJiraConfigFromEnv, JiraClient, type JiraIssueFields } from '@/lib/jira/client'

const requestSchema = z.object({
  dryRun: z.boolean().optional(),
  skipIfExists: z.boolean().optional(),
  projectKey: z.string().min(2).optional()
})

function unauthorized() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, response: unauthorized() }
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  const role = String(membership?.role || '').toLowerCase()
  const isAdminRole = role.includes('admin') || role.includes('owner') || role.includes('master')
  const fallbackEmailAdmin = typeof user.email === 'string' && user.email === 'lenine.engrene@gmail.com'

  if (!isAdminRole && !fallbackEmailAdmin) {
    return { ok: false as const, response: forbidden() }
  }

  return { ok: true as const, userId: user.id, email: user.email ?? null }
}

function buildAtlassianDescription(description: string) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: description }]
      }
    ]
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.ok) {
    return adminCheck.response
  }

  const jiraConfig = getJiraConfigFromEnv()
  if (!jiraConfig) {
    return NextResponse.json(
      {
        error: 'Jira env vars are not configured.',
        required: ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY']
      },
      { status: 400 }
    )
  }

  try {
    const body = requestSchema.parse(await request.json().catch(() => ({})))
    const projectKey = (body.projectKey || process.env.JIRA_PROJECT_KEY || '').trim()
    const dryRun = body.dryRun === true
    const skipIfExists = body.skipIfExists !== false

    if (!projectKey) {
      return NextResponse.json({ error: 'projectKey is required (body.projectKey or JIRA_PROJECT_KEY).' }, { status: 400 })
    }

    const client = new JiraClient(jiraConfig)
    const issueTypeEpic = process.env.JIRA_EPIC_ISSUE_TYPE?.trim() || 'Epic'
    const issueTypeStory = process.env.JIRA_STORY_ISSUE_TYPE?.trim() || 'Story'
    const storyPointsField = process.env.JIRA_STORY_POINTS_FIELD_ID?.trim() || ''
    const epicNameField = process.env.JIRA_EPIC_NAME_FIELD_ID?.trim() || ''
    const epicLinkField = process.env.JIRA_EPIC_LINK_FIELD_ID?.trim() || ''
    const labels = ['campaign-squad', 'conversation', 'rag', 'qa']

    let epicKey: string | null = null
    let epicCreated = false
    let epicExisting = false

    const foundEpic = skipIfExists
      ? await client.searchIssueByExactSummary(projectKey, CAMPAIGN_SQUAD_JIRA_EPIC_SUMMARY)
      : null

    if (foundEpic) {
      epicKey = foundEpic.key
      epicExisting = true
    } else if (!dryRun) {
      const epicFields: JiraIssueFields = {
        project: { key: projectKey },
        summary: CAMPAIGN_SQUAD_JIRA_EPIC_SUMMARY,
        issuetype: { name: issueTypeEpic },
        description: buildAtlassianDescription(CAMPAIGN_SQUAD_JIRA_EPIC_DESCRIPTION),
        labels,
        priority: { name: 'High' }
      }

      if (epicNameField) {
        epicFields[epicNameField] = CAMPAIGN_SQUAD_JIRA_EPIC_SUMMARY
      }

      const createdEpic = await client.createIssue(epicFields)
      epicKey = createdEpic.key
      epicCreated = true
    }

    const createdStories: Array<{ key: string; summary: string }> = []
    const existingStories: Array<{ key: string; summary: string }> = []
    const failedStories: Array<{ summary: string; reason: string }> = []

    for (const story of CAMPAIGN_SQUAD_JIRA_STORIES) {
      try {
        const existing = skipIfExists
          ? await client.searchIssueByExactSummary(projectKey, story.summary)
          : null

        if (existing) {
          existingStories.push({ key: existing.key, summary: story.summary })
          continue
        }

        if (dryRun) {
          continue
        }

        const storyFields: JiraIssueFields = {
          project: { key: projectKey },
          summary: story.summary,
          issuetype: { name: issueTypeStory },
          description: buildAtlassianDescription(story.description),
          labels,
          priority: { name: story.priority }
        }

        if (storyPointsField) {
          storyFields[storyPointsField] = story.storyPoints
        }

        if (epicLinkField && epicKey) {
          storyFields[epicLinkField] = epicKey
        } else if (epicKey) {
          storyFields.parent = { key: epicKey }
        }

        const createdStory = await client.createIssue(storyFields)
        createdStories.push({ key: createdStory.key, summary: story.summary })
      } catch (error) {
        failedStories.push({
          summary: story.summary,
          reason: error instanceof Error ? error.message : 'Unknown Jira error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      projectKey,
      epic: {
        key: epicKey,
        created: epicCreated,
        existing: epicExisting,
        summary: CAMPAIGN_SQUAD_JIRA_EPIC_SUMMARY
      },
      stories: {
        created: createdStories,
        existing: existingStories,
        failed: failedStories,
        totalTemplate: CAMPAIGN_SQUAD_JIRA_STORIES.length
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Invalid payload',
          issues: error.issues
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync Jira backlog'
      },
      { status: 500 }
    )
  }
}

