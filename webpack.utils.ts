import * as fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export function findDependencies(toSearch: string, searched: Set<string>, deps: Set<string>) {
    searched.add(toSearch)
    try {
        const modulePath = path.normalize(path.join(process.cwd(), 'node_modules', toSearch))
        const packageJsonPath = path.join(modulePath, "package.json")
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        const packagesToSearch: Set<string> = new Set();

        const dependencies = Object.keys(packageJson['dependencies'] ?? {}) as string[];

        const peerDependenciesMeta = Object.keys(packageJson['peerDependenciesMeta'] ?? {}) as string[];

        const optionalDependencies = Object.keys(packageJson['optionalDependencies'] ?? {}) as string[];

        const allDependencies = new Set([...dependencies, ...peerDependenciesMeta, ...optionalDependencies]);

        for (const dep of allDependencies) {
            if (!searched.has(dep)) {
                packagesToSearch.add(dep);
                deps.add(dep);
            }
        }

        for (const pack of packagesToSearch) {
            findDependencies(pack, searched, deps);
        }
    } catch (error) {
        /** */
        deps.delete(toSearch)
    }
}

export function buildExternalsObject(externals: string[]) {
    const result: { [key: string]: string } = {}
    const searched = new Set<string>(externals);
    const deps = new Set(externals)

    externals.forEach(c => findDependencies(c, searched, deps));

    deps.forEach(c => result[c] = `commonjs ${c}`);

    // console.log(result)
    // fs.writeFileSync("data.json", JSON.stringify(result, null, 4))
    return result;
}

export function runCommandAt(command: string,runPath: string){
    return new Promise<void>((res,rej) => {
        const commandProcess = exec(`${command} --prefix ${runPath}`)

        commandProcess.stdout?.pipe(process.stdout);

        commandProcess.stderr?.pipe(process.stderr);

        commandProcess.on('exit',()=>{
            res()
        })

        commandProcess.on('error',(e) => {
            rej(e)
        })
    })

}