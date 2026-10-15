import { openDB, IDBPDatabase } from 'idb';
import { Project, migrateProject, projectSchema } from '../../domain/projects/project-schema';
export class ProjectRepository {
  private db: Promise<IDBPDatabase> | null = null;
  private open(): Promise<IDBPDatabase> {
    return (this.db ??= openDB('epicycle-studio', 1, {
      upgrade(db) {
        const p = db.createObjectStore('projects', { keyPath: 'id' });
        p.createIndex('updatedAt', 'updatedAt');
        db.createObjectStore('drafts', { keyPath: 'id' });
        db.createObjectStore('backups', { keyPath: 'id' });
      },
    }));
  }
  async list(): Promise<Project[]> {
    return (await (await this.open()).getAll('projects'))
      .map(migrateProject)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(id: string): Promise<Project | undefined> {
    const raw = await (await this.open()).get('projects', id);
    return raw ? migrateProject(raw) : undefined;
  }
  async save(p: Project): Promise<void> {
    projectSchema.parse(p);
    const db = await this.open(),
      tx = db.transaction(['projects', 'drafts', 'backups'], 'readwrite'),
      old = await tx.objectStore('projects').get(p.id);
    if (old) await tx.objectStore('backups').put(old);
    await tx.objectStore('projects').put(p);
    await tx.objectStore('drafts').delete(p.id);
    await tx.done;
  }
  async draft(p: Project): Promise<void> {
    await (await this.open()).put('drafts', projectSchema.parse(p));
  }
  async drafts(): Promise<Project[]> {
    return (await (await this.open()).getAll('drafts'))
      .map(migrateProject)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async discardDraft(id: string): Promise<void> {
    await (await this.open()).delete('drafts', id);
  }
  async remove(id: string): Promise<void> {
    const tx = (await this.open()).transaction(['projects', 'drafts'], 'readwrite');
    await tx.objectStore('projects').delete(id);
    await tx.objectStore('drafts').delete(id);
    await tx.done;
  }
  async close(): Promise<void> {
    if (this.db) (await this.db).close();
    this.db = null;
  }
}
