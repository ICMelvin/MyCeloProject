import { http, createConfig } from 'wagmi';
import { celoSepolia, celoMainnet } from './chain';
import { walletConnect, injected } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const isMainnet = import.meta.env.VITE_NETWORK === 'mainnet';

export const config = createConfig({
  chains: [celoSepolia, celoMainnet],
  connectors: [
    walletConnect({
      projectId: projectId || '',
      showQrModal: true,
    }),
    injected(),
  ],
  transports: {
    [celoSepolia.id]: http(),
    [celoMainnet.id]: http(),
  },
});
