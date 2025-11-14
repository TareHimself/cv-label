import { IDatabaseInstance } from "@types";
import { RealmDatabaseInstance } from './RealmDatabase'

let databaseInstance: IDatabaseInstance | undefined = undefined

export async function openDatabase(projectId: string): Promise<IDatabaseInstance> {
    const db = new RealmDatabaseInstance()
    await db.open(projectId)
    databaseInstance = db
    return databaseInstance
}

export function getDatabase() : IDatabaseInstance | undefined {
    return databaseInstance;
}