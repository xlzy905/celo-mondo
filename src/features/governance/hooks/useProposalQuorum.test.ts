import '@testing-library/jest-dom';
import { waitFor } from '@testing-library/react';
import BigNumber from 'bignumber.js';
import { afterEach, beforeEach } from 'node:test';
import { toFixidity } from 'src/utils/numbers';
import { describe, expect, it, vi } from 'vitest';
import { publicArchiveClient, renderHook } from '../../../test/anvil/utils';
import {
  extractFunctionSignature,
  fetchThresholds,
  useParticipationParameters,
  useProposalQuorum,
} from './useProposalQuorum';

beforeEach(() => {
  vi.mock('wagmi', async (importActual) => ({
    ...(await importActual()),
    usePublicClient: () => publicArchiveClient,
    useReadContract: vi.fn(() => ({
      data: [
        60000000000000000000000n, // baseline
        50000000000000000000000n, // baselineFloor
        200000000000000000000000n, // baselineUpdateFactor
        500000000000000000000000n, // baselineQuorumFactor
      ],
    })),
  }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('extractFunctionSignature', () => {
  it('gets the four first bytes of a byte array', () => {
    expect(extractFunctionSignature('0x112233445566778899')).toBe('0x11223344');
    expect(extractFunctionSignature('1234567890' as `0x${string}`)).toBe('0x12345678');
  });
});

describe('fetchThresholds', () => {
  it('fetches the constitution threshholds properly #2', async () => {
    // Proposal for Creation of Celo Governance Guild's execution block - 1
    process.env.NEXT_PUBLIC_FORK_BLOCK_NUMBER = '0x1bb55ea';
    const expectedNumberOfTxs = 1n;
    const proposalId = 195;
    const spy = vi.spyOn(publicArchiveClient, 'multicall');
    await expect(
      fetchThresholds(publicArchiveClient, proposalId, expectedNumberOfTxs),
    ).resolves.toMatchSnapshot();
    expect(spy.mock.results[0].value).resolves.toHaveLength(Number(expectedNumberOfTxs));
    expect(spy.mock.calls.length).toBe(2);
  });

  it('fetches the constitution threshholds properly #2', async () => {
    // Enabling MENTO Governance's proposal block
    process.env.NEXT_PUBLIC_FORK_BLOCK_NUMBER = '0x1baa98c';
    const expectedNumberOfTxs = 50n;
    const proposalId = 196;
    const spy = vi.spyOn(publicArchiveClient, 'multicall');
    await expect(
      fetchThresholds(publicArchiveClient, proposalId, expectedNumberOfTxs),
    ).resolves.toMatchSnapshot();
    expect(spy.mock.results[0].value).resolves.toHaveLength(Number(expectedNumberOfTxs));
    expect(spy.mock.calls.length).toBe(2);
  });
});

describe('useParticipationParameters', () => {
  it('fetches the params from the governance contract', async () => {
    const { result } = renderHook(() => useParticipationParameters());
    await waitFor(() => expect(result.current.isLoading).not.toBe(true));
    expect(result.current).toMatchSnapshot();
  });
});

describe('useProposalQuorum', () => {
  it('maths properly', async () => {
    // Enabling MENTO Governance's proposal block
    process.env.NEXT_PUBLIC_FORK_BLOCK_NUMBER = '0x1baa98c';
    const baseline = 0.06;
    const baselineQuorumFactor = 0.5;
    let calls = 0;
    vi.spyOn(publicArchiveClient, 'multicall').mockImplementation(async () => {
      if (calls++ === 0) {
        return [
          ['0x', '0x', '0x'],
          ['0x', '0x', '0x'],
          ['0x', '0x', '0x'],
        ];
      } else {
        return [0.75, 0.1, 0.5].map(toFixidity);
      }
    });
    const networkWeight = 200000000000000000000000000n;

    const quorumPct = baseline * baselineQuorumFactor;
    const quorumVotes = new BigNumber(networkWeight.toString()).times(quorumPct);
    const maxThreshold = quorumVotes.times(0.75 /* highest mocked threshold */);

    const { result } = renderHook(() =>
      // @ts-expect-error
      useProposalQuorum({ proposal: { id: 1, numTransactions: 3, networkWeight } }),
    );
    await waitFor(() => expect(result.current.isLoading).not.toBe(true));
    expect(result.current.data).toBe(BigInt(maxThreshold.toFixed(0)));
    expect(BigInt(maxThreshold.toFixed(0))).toMatchInlineSnapshot(`4500000000000000000000000n`);
  });
});
