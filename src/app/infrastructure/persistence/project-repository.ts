import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { Project, migrateProject, projectSchema } from '../../domain/projects/project-schema';
interface ProjectDatabase extends DBSchema {
  projects: { key: string; value: unknown; indexes: { updatedAt: string } };
  drafts: { key: string; value: unknown };
  backups: { key: string; value: unknown };
}
export class ProjectRepository {
  private db: Promise<IDBPDatabase<ProjectDatabase>> | null = null;
  constructor(
    private readonly openDatabase: typeof openDB<ProjectDatabase> = openDB<ProjectDatabase>,
  ) {}
  private open(): Promise<IDBPDatabase<ProjectDatabase>> {
    if (this.db) return this.db;
    const pending = this.openDatabase('epicycle-studio', 1, {
      upgrade(db) {
        const p = db.createObjectStore('projects', { keyPath: 'id' });
        p.createIndex('updatedAt', 'updatedAt');
        db.createObjectStore('drafts', { keyPath: 'id' });
        db.createObjectStore('backups', { keyPath: 'id' });
      },
    }).catch((error: unknown) => {
      if (this.db === pending) this.db = null;
      throw error;
    });
    this.db = pending;
    return pending;
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
    const project = projectSchema.parse(p);
    const db = await this.open(),
      tx = db.transaction(['projects', 'drafts', 'backups'], 'readwrite'),
      old = await tx.objectStore('projects').get(project.id);
    if (old) await tx.objectStore('backups').put(old);
    await tx.objectStore('projects').put(project);
    await tx.objectStore('drafts').delete(project.id);
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
    const pending = this.db;
    this.db = null;
    if (!pending) return;
    // A rejected open was already reported to its caller and acquired no connection.
    const [connection] = await Promise.allSettled([pending]);
    if (connection.status === 'fulfilled') connection.value.close();
  }
}
