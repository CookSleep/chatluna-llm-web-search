import { Context } from 'koishi';
import { type Config } from './config';
export { Config, inject, name, usage } from './config';
export declare function apply(ctx: Context, cfg: Config): void;
