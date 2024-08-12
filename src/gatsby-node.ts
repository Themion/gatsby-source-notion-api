import type { GatsbyNode, NodePluginArgs, PluginOptions, Reporter } from 'gatsby';
import { importNotionSource } from '~/import-notion-source';
import type { Options } from '~/types';

const time = async (args: NodePluginArgs, options: PluginOptions & Options, message: string) => {
  const { reporter } = args;
  const activity = reporter.activityTimer(message);
  activity.start()

  return importNotionSource(args, options)
    .catch(reporter.error)
    .finally(() => {
      activity.end();
    });
}

export const sourceNodes: GatsbyNode['sourceNodes'] = (args, options: PluginOptions & Options) => {
  time(args, options, `Fetching data from notion database ${options.databaseId}`)
};

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

      time(args, options, `Refetching data from notion database ${options.databaseId}`).finally(() => {
        intervalFlag = false;
      })
    };
    setInterval(intervalFunc, devServerRefreshInterval);
  }
};
