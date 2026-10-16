const mockSign = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn(),
  isAllowed: jest.fn(),
  setAllowed: jest.fn(),
  getAddress: jest.fn(),
  getNetwork: jest.fn(),
  signTransaction: (...args: unknown[]) => mockSign(...args),
}));

jest.mock("./config", () => ({ STELLAR_NETWORK: "PUBLIC" }));

import { NETWORK_PASSPHRASES, signTransaction } from "./wallet";

describe("signTransaction", () => {
  beforeEach(() => mockSign.mockReset());

  it("signs with the shared passphrase for the configured network", async () => {
    mockSign.mockResolvedValue({ signedTxXdr: "signed" });
    await signTransaction("xdr", "GABC");
    expect(mockSign).toHaveBeenCalledWith("xdr", {
      address: "GABC",
      networkPassphrase: NETWORK_PASSPHRASES.PUBLIC,
    });
  });
});

describe("NETWORK_PASSPHRASES", () => {
  it("has the canonical Stellar passphrases", () => {
    expect(NETWORK_PASSPHRASES).toEqual({
      PUBLIC: "Public Global Stellar Network ; September 2015",
      TESTNET: "Test SDF Network ; September 2015",
    });
  });
});
