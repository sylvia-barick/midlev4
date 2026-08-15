import React, { type PropsWithChildren, createContext } from 'react';
import { type DeployedSplitsAPIProvider, BrowserDeployedSplitsManager } from './BrowserDeployedSplitsManager';
import { type Logger } from 'pino';

/**
 * Encapsulates a deployed splits provider as a context object.
 */
export const DeployedSplitsContext = createContext<DeployedSplitsAPIProvider | undefined>(undefined);

/**
 * The props required by the DeployedSplitsProvider component.
 */
export type DeployedSplitsProviderProps = PropsWithChildren<{
  /** The pino logger to use. */
  logger: Logger;
}>;

/**
 * A React component that sets a new BrowserDeployedSplitsManager object as the currently
 * in-scope deployed splits provider.
 */
export const DeployedSplitsProvider: React.FC<Readonly<DeployedSplitsProviderProps>> = ({ logger, children }) => (
  <DeployedSplitsContext.Provider value={new BrowserDeployedSplitsManager(logger)}>
    {children}
  </DeployedSplitsContext.Provider>
);
