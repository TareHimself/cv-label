/* eslint-disable @typescript-eslint/no-unused-vars */
import { PluginBase } from '@electron-forge/plugin-base';
import { ForgeMultiHookMap, ResolvedForgeConfig, StartResult, ForgePlatform, ForgeArch, StartOptions } from '@electron-forge/shared-types';
import * as fs from 'fs';
import path from 'path';
import chalk from 'chalk'
const logger = fs.createWriteStream('log.txt', 'utf-8')
export interface SourcePluginConfig {
    externals: string[]
}

export default class SourcePlugin extends PluginBase<SourcePluginConfig> {
    override name = "CopyExternalsPlugin";
    config: SourcePluginConfig;
    isRunningLogic: boolean;
    baseDir = path.join(process.cwd(), '.source');
    rendererPort = 10000

    constructor(config: SourcePluginConfig) {
        super(config);
        this.config = config
        this.config.externals = this.config.externals.map(c => path.join(...c.split('/')))
        this.isRunningLogic = false;
    }

    async compileMain(watch = false) {
        /** */
    }

    async compileRenderer(watch = false) {
        /** */
    }

    override async startLogic(opts: StartOptions): Promise<StartResult> {
        if (this.isRunningLogic) return false;
        this.isRunningLogic = true;

        try {
            await fs.promises.rm(this.baseDir, {
                recursive: true
            });
        } catch (error) {
            /** */
        }



        return {
            tasks: [
                {
                    title: 'Compiling main process code',
                    task: async () => {
                        await this.compileMain(true);
                    },
                    options: {
                        showTimer: true,
                    },
                },
                {
                    title: 'Launching dev servers for renderer process code',
                    task: async (_, task) => {
                        await this.compileRenderer();
                        task.output = `Output Available: ${chalk.cyan(`http://localhost:${this.rendererPort}`)}\n`;
                    },
                    options: {
                        persistentOutput: true,
                        showTimer: true,
                    },
                },
            ],
            result: false,
        };
    }



}