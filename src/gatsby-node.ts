import { GatsbyNode, PluginOptions } from 'gatsby';
import { importNotionSource } from './import-notion-source';
import { Options } from './types';

export const sourceNodes: GatsbyNode['sourceNodes'] = (args, options: PluginOptions & Options) =>
  importNotionSource(args, options);

export const onCreateDevServer: GatsbyNode['onCreateDevServer'] = (
  args,
  options: PluginOptions & Options,
) => {
  const { devServerRefreshInterval } = options;
  if (devServerRefreshInterval)
    setInterval(() => importNotionSource(args, options), devServerRefreshInterval);
};
