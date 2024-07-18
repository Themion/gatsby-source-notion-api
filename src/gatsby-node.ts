import type { GatsbyNode, PluginOptions } from 'gatsby';
import { importNotionSource } from './import-notion-source';
import type { Options } from './types';

export const sourceNodes: GatsbyNode['sourceNodes'] = (args, options: PluginOptions & Options) =>
  importNotionSource(args, options);

export const onCreateDevServer: GatsbyNode['onCreateDevServer'] = (
  args,
  options: PluginOptions & Options,
) => {
  const { devServerRefreshInterval } = options;
  if (devServerRefreshInterval) {
    const intervalFunc = () => importNotionSource(args, options)
      .catch((error) => console.warn(`Failed to re-fetch Notion data: ${error}`))
    setInterval(intervalFunc, devServerRefreshInterval);
  }
};
