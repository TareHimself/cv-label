/* eslint-disable @typescript-eslint/no-unused-vars */
import { PluginBase } from '@electron-forge/plugin-base';
import { ForgeMultiHookMap, ResolvedForgeConfig, StartResult, ForgePlatform, ForgeArch } from '@electron-forge/shared-types';
import * as fs from 'fs';
import path from 'path';
const logger = fs.createWriteStream('log.txt', 'utf-8')
export interface ExternalsPluginConfig {
    externals: string[]
}

export default class ExternalsPlugin extends PluginBase<ExternalsPluginConfig> {
    override name = "CopyExternalsPlugin";
    config: ExternalsPluginConfig;

    constructor(config: ExternalsPluginConfig) {
        super(config);
        this.config = config
        //this.config.externals = this.config.externals.map(c => path.join(...c.split('/')))
    }

    // resolvePackage(packageName: string) {
    //     return path.join(process.cwd(), 'node_modules', ...packageName.split('/'))
    // }

    // async findPackagePath(packageName: string): Promise<{
    //     path: string;
    //     deps: string[];
    // } | undefined> {
    //     // const entryFilePath = require.resolve(packageName)
    //     // const filePathSplit = entryFilePath.split(path.sep)
    //     // const nodeModulesIndex = filePathSplit.indexOf('node_modules')
    //     // const moduleFolder = filePathSplit.slice(nodeModulesIndex + 1)
    //     // const actualModuleFolder = path.join(filePathSplit.slice(0, nodeModulesIndex + 1).join(path.sep), moduleFolder[0].startsWith('@') ? moduleFolder.slice(0, 2).join(path.sep) : moduleFolder[0])
    //     const actualModuleFolder = this.resolvePackage(packageName)
    //     try {
    //         const packageJson = JSON.parse(await fs.promises.readFile(path.join(actualModuleFolder, "package.json"), 'utf-8'))
    //         const deps = packageJson['dependencies']

    //         return {
    //             path: actualModuleFolder,
    //             deps: deps !== undefined ? Object.keys(deps) : []
    //         }
    //     } catch (error) {
    //         console.error(error)
    //         return undefined
    //     }
    // }


    getHooks() {
        return {
            resolveForgeConfig: async (config: ResolvedForgeConfig) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const oldIgnore = config.packagerConfig.ignore as (((p: string) => boolean) | undefined)
                // const unpackGlob = `{${this.config.externals.map(c => `**/${c.startsWith('@') ? "\\\\" + c : c}/build/*.*`).join(",")}}`
                // config.packagerConfig.asar = {
                //     unpack: `**/*.node`
                // }
                //logger.write(`GLOB ${config.packagerConfig.asar.unpack} \n`)
                config.packagerConfig.ignore = (itemPath) => {
                    const result = oldIgnore ? oldIgnore(itemPath) : true
                    if (!result) {
                        return false;
                    }

                    if (itemPath === "/node_modules") {
                        return false;
                    }

                    for (const external of this.config.externals) {

                        if (itemPath.startsWith(`/node_modules/${external}`) || itemPath.startsWith(`/node_modules/${external.split('/')[0]}`)) {
                            logger.write(`MOVED ${external} ${itemPath} \n`)
                            return false;
                        }
                    }
                    return true
                }

                return config
            }
        }
    }
}