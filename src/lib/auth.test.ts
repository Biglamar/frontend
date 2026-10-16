import { TOKEN_KEY, clearToken, getToken, setToken } from "./auth";

// Safari private browsing / disabled storage surface as a DOMException.
const quotaError = () => new DOMException("The quota has been exceeded.", "QuotaExceededError");
const securityError = () => new DOMException("Access is denied.", "SecurityError");

describe("lib/auth token storage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  describe("round-trip", () => {
    it("returns null when no token has been stored", () => {
      expect(getToken()).toBeNull();
    });

    it("setToken then getToken returns the stored value under TOKEN_KEY", () => {
      setToken("jwt-abc");
      expect(getToken()).toBe("jwt-abc");
      expect(window.localStorage.getItem(TOKEN_KEY)).toBe("jwt-abc");
    });

    it("setToken overwrites a previous token", () => {
      setToken("old");
      setToken("new");
      expect(getToken()).toBe("new");
    });

    it("clearToken removes the stored token", () => {
      setToken("jwt-abc");
      clearToken();
      expect(getToken()).toBeNull();
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it("clearToken is a no-op when nothing is stored", () => {
      expect(() => clearToken()).not.toThrow();
      expect(getToken()).toBeNull();
    });

    it("uses the documented storage key", () => {
      expect(TOKEN_KEY).toBe("mergefi_token");
    });
  });

  describe("storage failures degrade instead of throwing", () => {
    it("getToken returns null when localStorage.getItem throws", () => {
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw securityError();
      });
      expect(() => getToken()).not.toThrow();
      expect(getToken()).toBeNull();
    });

    it("setToken swallows QuotaExceededError from localStorage.setItem", () => {
      const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw quotaError();
      });
      expect(() => setToken("jwt-abc")).not.toThrow();
      expect(setItem).toHaveBeenCalledWith(TOKEN_KEY, "jwt-abc");
    });

    it("clearToken swallows errors from localStorage.removeItem", () => {
      const removeItem = jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw securityError();
      });
      expect(() => clearToken()).not.toThrow();
      expect(removeItem).toHaveBeenCalledWith(TOKEN_KEY);
    });

    it("a failed setToken leaves any previously stored token untouched", () => {
      setToken("existing");
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw quotaError();
      });
      setToken("replacement");
      jest.restoreAllMocks();
      expect(getToken()).toBe("existing");
    });

    it("getToken returns null when accessing window.localStorage itself throws", () => {
      // Some browsers throw on the property access when storage is disabled.
      jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw securityError();
      });
      expect(getToken()).toBeNull();
      expect(() => setToken("x")).not.toThrow();
      expect(() => clearToken()).not.toThrow();
    });
  });
});
