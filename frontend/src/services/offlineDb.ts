import Dexie, { type Table } from 'dexie'
import type { Draft, LocalVisit, ServerVisit } from '../types/visit'
import { upgradeVisit } from '../types/visit'

class VisitDatabase extends Dexie {
  visits!: Table<LocalVisit, string>
  drafts!: Table<Draft & { key: string }, string>
  constructor() {
    super('em-casa-v1')
    this.version(1).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' })
    this.version(2).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' }).upgrade(async tx => {
      await tx.table('visits').toCollection().modify((row: LocalVisit) => {
        row.visit = upgradeVisit(row.visit)
        if (row.conflict) row.conflict.visit = upgradeVisit(row.conflict.visit)
      })
      await tx.table('drafts').toCollection().modify((row: Draft) => { row.visit = upgradeVisit(row.visit) })
    })
    this.version(3).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' }).upgrade(async tx => {
      await tx.table('visits').toCollection().modify((row: LocalVisit) => {
        row.visit = upgradeVisit(row.visit)
        if (row.conflict) row.conflict.visit = upgradeVisit(row.conflict.visit)
      })
      await tx.table('drafts').toCollection().modify((row: Draft) => { row.visit = upgradeVisit(row.visit) })
    })
    this.version(4).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' }).upgrade(async tx => {
      await tx.table('visits').toCollection().modify((row: LocalVisit) => {
        row.visit = upgradeVisit(row.visit)
        if (row.conflict) row.conflict.visit = upgradeVisit(row.conflict.visit)
      })
      await tx.table('drafts').toCollection().modify((row: Draft) => { row.visit = upgradeVisit(row.visit) })
    })
  }
}
export const db = new VisitDatabase()
export async function saveLocal(visit: LocalVisit['visit'], soap_text: string, revision: number, soap_blocks: LocalVisit['soap_blocks'] = null) {
  await db.transaction('rw', db.visits, db.drafts, async () => {
    const old = await db.visits.get(visit.id)
    await db.visits.put({ visit, soap_text, soap_blocks, revision, localVersion: (old?.localVersion ?? 0) + 1, pending: true, conflict: old?.conflict })
    await db.drafts.delete('active')
  })
}
export async function applySync(sent: LocalVisit, server: ServerVisit, conflict = false) {
  await db.transaction('rw', db.visits, async () => {
    const current = await db.visits.get(sent.visit.id)
    if (!current) return
    if (conflict) { await db.visits.put({ ...current, conflict: server }); return }
    // Edições feitas enquanto a requisição estava em voo continuam pendentes.
    await db.visits.put(current.localVersion === sent.localVersion
      ? { ...server, pending: false, localVersion: current.localVersion }
      : { ...current, revision: server.revision })
  })
}
export async function mergeRemote(rows: ServerVisit[]) {
  await db.transaction('rw', db.visits, async () => {
    for (const row of rows) { const current = await db.visits.get(row.visit.id); if (!current || !current.pending) await db.visits.put({ ...row, pending: false, localVersion: current?.localVersion ?? 0 }) }
  })
}
