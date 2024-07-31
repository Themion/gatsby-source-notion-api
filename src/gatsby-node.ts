import type { GatsbyNode, PluginOptions } from 'gatsby';
import { importNotionSource } from '~/import-notion-source';
import type { Options } from '~/types';

export const sourceNodes: GatsbyNode['sourceNodes'] = (args, options: PluginOptions & Options) =>
  importNotionSource(args, options);

export const onCreateDevServer: GatsbyNode['onCreateDevServer'] = (
  args,
  options: PluginOptions & Options,
) => {
  const { devServerRefreshInterval } = options;
  const { reporter } = args;

  if (devServerRefreshInterval) {
    let intervalFlag = false;

    const intervalFunc = () => {
      if (intervalFlag) {
        reporter.warn('Refetch cancelled to prevent overriding previous fetch!');
        return;
      }
      intervalFlag = true;

      const activity = reporter.activityTimer(
        `Refetching data from notion database ${options.databaseId}`,
      );
      activity.start();

      importNotionSource(args, options)
        .catch(reporter.error)
        .finally(() => {
          intervalFlag = false;
          activity.end();
        });
    };
    setInterval(intervalFunc, devServerRefreshInterval);
  }
};
