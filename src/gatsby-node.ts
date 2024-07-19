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
    let intervalFlag = false;

    const intervalFunc = () => {
      if (intervalFlag) {
        console.warn('Refetch cancelled due to previous fetch!')
        return;
      }
      intervalFlag = true;

      importNotionSource(args, options)
        .catch((error) => console.warn(`Failed to refetch Notion data: ${error}`))
        .finally(() => { intervalFlag = false; })
    }
    setInterval(intervalFunc, devServerRefreshInterval);
  }
};
