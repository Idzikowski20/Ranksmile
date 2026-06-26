import db from '../database/database';

let tablesChecked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';

/**
 * Swallow the "already exists / duplicate" errors that idempotent ALTER/CREATE
 * statements throw on re-run, but LOG anything else (permission denied, offline,
 * syntax) loudly — a blanket `catch {}` would mask a real failure as success.
 */
function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as any)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[tenancy] ${label} failed:`, m);
}

/** Creates the org/workspace/member tables and the domain.workspace_id column. Idempotent. */
export async function ensureTenancyTables(): Promise<void> {
   if (tablesChecked) return;

   await db.query(`
      CREATE TABLE IF NOT EXISTS organizations (
         id            ${PK},
         owner_user_id TEXT NOT NULL,
         name          TEXT,
         logo_url      TEXT,
         created_at    TIMESTAMP DEFAULT ${NOW},
         updated_at    TIMESTAMP DEFAULT ${NOW}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
         id         ${PK},
         org_id     INTEGER NOT NULL,
         name       TEXT NOT NULL DEFAULT 'Default',
         created_at TIMESTAMP DEFAULT ${NOW}
      )
   `);

   await db.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
         id         ${PK},
         org_id     INTEGER NOT NULL,
         user_id    TEXT NOT NULL,
         role       TEXT NOT NULL DEFAULT 'owner',
         status     TEXT NOT NULL DEFAULT 'active',
         created_at TIMESTAMP DEFAULT ${NOW}
      )
   `);

   // domain.workspace_id — tenancy scope key. Harmless failure if it already exists.
   try { await db.query('ALTER TABLE domain ADD COLUMN workspace_id INTEGER'); } catch (e) { ignoreExisting('add domain.workspace_id', e); }

   // UNIQUE on owner_user_id enforces one org per owner (① invariant) AND serves as
   // the lookup index — it is the serialization point that prevents the provisioning
   // race (two concurrent first-requests can't both INSERT an org for the same user).
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_owner ON organizations(owner_user_id)'); } catch (e) { ignoreExisting('idx_org_owner', e); }
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique ON organization_members(org_id, user_id)'); } catch (e) { ignoreExisting('idx_org_members_unique', e); }
   // UNIQUE(org_id, name): one workspace per name within an org. Closes the migrate
   // duplicate-window; the insert helpers in lib/workspaces.ts + lib/tenancy.ts catch
   // its violation and re-read, so a race yields one row, not a 500. (On a DB that
   // already has duplicates this CREATE fails and is logged — race-safe inserts still apply.)
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_org_name ON workspaces(org_id, name)'); } catch (e) { ignoreExisting('idx_workspaces_org_name', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id)'); } catch (e) { ignoreExisting('idx_workspaces_org', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)'); } catch (e) { ignoreExisting('idx_org_members_user', e); }
   // (user_id, status) matches MEMBERSHIP_SQL's filter exactly — the hottest tenancy lookup.
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_org_members_user_status ON organization_members(user_id, status)'); } catch (e) { ignoreExisting('idx_org_members_user_status', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_domain_workspace ON domain(workspace_id)'); } catch (e) { ignoreExisting('idx_domain_workspace', e); }

   await db.query(`
      CREATE TABLE IF NOT EXISTS invitations (
         id            ${PK},
         org_id        INTEGER NOT NULL,
         email         TEXT NOT NULL,
         role          TEXT NOT NULL DEFAULT 'member',
         workspace_ids TEXT,
         token         TEXT NOT NULL,
         status        TEXT NOT NULL DEFAULT 'pending',
         invited_by    TEXT,
         expires_at    TIMESTAMP,
         created_at    TIMESTAMP DEFAULT ${NOW}
      )
   `);
   // Per-workspace member access (JSON array of workspace ids; NULL = all workspaces in the org).
   try { await db.query('ALTER TABLE organization_members ADD COLUMN workspace_ids TEXT'); } catch (e) { ignoreExisting('add organization_members.workspace_ids', e); }
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)'); } catch (e) { ignoreExisting('idx_invitations_token', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(org_id)'); } catch (e) { ignoreExisting('idx_invitations_org', e); }
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)'); } catch (e) { ignoreExisting('idx_invitations_email', e); }
   try { await db.query("ALTER TABLE workspaces ADD COLUMN status TEXT DEFAULT 'ready'"); } catch (e) { ignoreExisting('add workspaces.status', e); }
   try { await db.query('ALTER TABLE domain ADD COLUMN brand_knowledge TEXT'); } catch (e) { ignoreExisting('add domain.brand_knowledge', e); }

   if (!process.env.TENANCY_OWNER_USER_ID) {
      console.warn('[tenancy] TENANCY_OWNER_USER_ID is unset — legacy (NULL workspace) domains stay hidden until claimed.');
   }

   tablesChecked = true;
}
