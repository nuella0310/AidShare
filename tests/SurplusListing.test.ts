// surplus-listing.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Listing {
  seller: string;
  itemHash: string; // Represent buff as string for simplicity
  quantity: number;
  expiration: number;
  description: string;
  price: number;
  active: boolean;
  createdAt: number;
  lastUpdated: number;
}

interface Category {
  category: string;
  tags: string[];
}

interface Status {
  status: string;
  visibility: boolean;
  notes: string;
}

interface Collaborator {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface UpdateHistory {
  updatedBy: string;
  changes: string;
  timestamp: number;
}

interface RevenueShare {
  percentage: number;
  totalReceived: number;
}

interface Verification {
  verifiedBy: string[];
  verificationNotes: string;
  verifiedAt: number;
}

interface ContractState {
  listings: Map<number, Listing>;
  listingCategories: Map<number, Category>;
  listingStatus: Map<number, Status>;
  listingCollaborators: Map<string, Collaborator>; // Key: `${listingId}-${collaborator}`
  listingUpdateHistory: Map<string, UpdateHistory>; // Key: `${listingId}-${version}`
  listingRevenueShares: Map<string, RevenueShare>; // Key: `${listingId}-${participant}`
  listingVerifications: Map<number, Verification>;
  contractOwner: string;
  contractPaused: boolean;
  listingCounter: number;
  minQuantity: number;
  maxDescriptionLength: number;
  feePercentage: number;
  currentBlock: number; // Mock block height
}

// Mock contract implementation
class SurplusListingMock {
  private state: ContractState = {
    listings: new Map(),
    listingCategories: new Map(),
    listingStatus: new Map(),
    listingCollaborators: new Map(),
    listingUpdateHistory: new Map(),
    listingRevenueShares: new Map(),
    listingVerifications: new Map(),
    contractOwner: "deployer",
    contractPaused: false,
    listingCounter: 0,
    minQuantity: 1,
    maxDescriptionLength: 1000,
    feePercentage: 5,
    currentBlock: 100, // Starting mock block
  };

  private ERR_NOT_AUTHORIZED = 100;
  private ERR_INVALID_LISTING = 101;
  private ERR_ALREADY_EXISTS = 102;
  private ERR_INVALID_QUANTITY = 103;
  private ERR_INVALID_EXPIRATION = 104;
  private ERR_INVALID_PRICE = 105;
  private ERR_LISTING_INACTIVE = 106;
  private ERR_NOT_OWNER = 107;
  private ERR_MAX_CATEGORIES_REACHED = 108;
  private ERR_INVALID_METADATA = 109;
  private ERR_PAUSED = 110;

  // Helper to advance block
  advanceBlock() {
    this.state.currentBlock += 1;
  }

  createListing(
    caller: string,
    itemHash: string,
    quantity: number,
    expiration: number,
    description: string,
    price: number
  ): ClarityResponse<number> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (quantity < this.state.minQuantity) {
      return { ok: false, value: this.ERR_INVALID_QUANTITY };
    }
    if (expiration <= this.state.currentBlock) {
      return { ok: false, value: this.ERR_INVALID_EXPIRATION };
    }
    if (price <= 0) {
      return { ok: false, value: this.ERR_INVALID_PRICE };
    }
    if (description.length > this.state.maxDescriptionLength) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    const newId = this.state.listingCounter + 1;
    this.state.listings.set(newId, {
      seller: caller,
      itemHash,
      quantity,
      expiration,
      description,
      price,
      active: true,
      createdAt: this.state.currentBlock,
      lastUpdated: this.state.currentBlock,
    });
    this.state.listingStatus.set(newId, {
      status: "available",
      visibility: true,
      notes: "",
    });
    this.state.listingCounter = newId;
    return { ok: true, value: newId };
  }

  updateListing(
    caller: string,
    listingId: number,
    newQuantity: number,
    newExpiration: number,
    newDescription: string,
    newPrice: number
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const listing = this.state.listings.get(listingId);
    if (!listing) {
      return { ok: false, value: this.ERR_INVALID_LISTING };
    }
    if (listing.seller !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (!listing.active) {
      return { ok: false, value: this.ERR_LISTING_INACTIVE };
    }
    if (newQuantity < this.state.minQuantity) {
      return { ok: false, value: this.ERR_INVALID_QUANTITY };
    }
    if (newExpiration <= this.state.currentBlock) {
      return { ok: false, value: this.ERR_INVALID_EXPIRATION };
    }
    if (newPrice <= 0) {
      return { ok: false, value: this.ERR_INVALID_PRICE };
    }
    if (newDescription.length > this.state.maxDescriptionLength) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    // Update listing
    this.state.listings.set(listingId, {
      ...listing,
      quantity: newQuantity,
      expiration: newExpiration,
      description: newDescription,
      price: newPrice,
      lastUpdated: this.state.currentBlock,
    });
    // Add to history (simplify version as map size)
    const historyKey = `${listingId}-${this.state.listingUpdateHistory.size + 1}`;
    this.state.listingUpdateHistory.set(historyKey, {
      updatedBy: caller,
      changes: "Updated quantity, expiration, description, price",
      timestamp: this.state.currentBlock,
    });
    return { ok: true, value: true };
  }

  deactivateListing(caller: string, listingId: number): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const listing = this.state.listings.get(listingId);
    if (!listing) {
      return { ok: false, value: this.ERR_INVALID_LISTING };
    }
    if (listing.seller !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.listings.set(listingId, { ...listing, active: false });
    const status = this.state.listingStatus.get(listingId);
    if (status) {
      this.state.listingStatus.set(listingId, { ...status, status: "inactive" });
    }
    return { ok: true, value: true };
  }

  addCategory(
    caller: string,
    listingId: number,
    category: string,
    tags: string[]
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const listing = this.state.listings.get(listingId);
    if (!listing) {
      return { ok: false, value: this.ERR_INVALID_LISTING };
    }
    if (listing.seller !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (!listing.active) {
      return { ok: false, value: this.ERR_LISTING_INACTIVE };
    }
    if (tags.length > 20) {
      return { ok: false, value: this.ERR_MAX_CATEGORIES_REACHED };
    }
    this.state.listingCategories.set(listingId, { category, tags });
    return { ok: true, value: true };
  }

  updateStatus(
    caller: string,
    listingId: number,
    newStatus: string,
    visibility: boolean,
    notes: string
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const listing = this.state.listings.get(listingId);
    if (!listing) {
      return { ok: false, value: this.ERR_INVALID_LISTING };
    }
    if (listing.seller !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (!listing.active) {
      return { ok: false, value: this.ERR_LISTING_INACTIVE };
    }
    this.state.listingStatus.set(listingId, { status: newStatus, visibility, notes });
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    listingId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const listing = this.state.listings.get(listingId);
    if (!listing) {
      return { ok: false, value: this.ERR_INVALID_LISTING };
    }
    if (listing.seller !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (!listing.active) {
      return { ok: false, value: this.ERR_LISTING_INACTIVE };
    }
    const key = `${listingId}-${collaborator}`;
    this.state.listingCollaborators.set(key, {
      role,
      permissions,
      addedAt: this.state.currentBlock,
    });
    return { ok: true, value: true };
  }

  setRevenueShare(
    caller: string,
    listingId: number,
    participant: string,
    percentage: number
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const listing = this.state.listings.get(listingId);
    if (!listing) {
      return { ok: false, value: this.ERR_INVALID_LISTING };
    }
    if (listing.seller !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (!listing.active) {
      return { ok: false, value: this.ERR_LISTING_INACTIVE };
    }
    if (percentage > 1000) {
      return { ok: false, value: this.ERR_INVALID_PRICE };
    }
    const key = `${listingId}-${participant}`;
    this.state.listingRevenueShares.set(key, { percentage, totalReceived: 0 });
    return { ok: true, value: true };
  }

  addVerification(
    caller: string,
    listingId: number,
    notes: string
  ): ClarityResponse<boolean> {
    if (this.state.contractPaused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const listing = this.state.listings.get(listingId);
    if (!listing) {
      return { ok: false, value: this.ERR_INVALID_LISTING };
    }
    const isOwner = listing.seller === caller;
    const collabKey = `${listingId}-${caller}`;
    const isCollaborator = this.state.listingCollaborators.has(collabKey);
    if (!isOwner && !isCollaborator) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    if (!listing.active) {
      return { ok: false, value: this.ERR_LISTING_INACTIVE };
    }
    let verification = this.state.listingVerifications.get(listingId) || {
      verifiedBy: [],
      verificationNotes: "",
      verifiedAt: 0,
    };
    const newVerifiedBy = [...verification.verifiedBy, caller];
    if (newVerifiedBy.length > 5) {
      return { ok: false, value: this.ERR_MAX_CATEGORIES_REACHED };
    }
    this.state.listingVerifications.set(listingId, {
      verifiedBy: newVerifiedBy,
      verificationNotes: notes,
      verifiedAt: this.state.currentBlock,
    });
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.contractPaused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.contractPaused = false;
    return { ok: true, value: true };
  }

  setMinQuantity(caller: string, newMin: number): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.minQuantity = newMin;
    return { ok: true, value: true };
  }

  getListingDetails(listingId: number): ClarityResponse<Listing | null> {
    return { ok: true, value: this.state.listings.get(listingId) ?? null };
  }

  getListingCategory(listingId: number): ClarityResponse<Category | null> {
    return { ok: true, value: this.state.listingCategories.get(listingId) ?? null };
  }

  getListingStatus(listingId: number): ClarityResponse<Status | null> {
    return { ok: true, value: this.state.listingStatus.get(listingId) ?? null };
  }

  getListingCollaborator(listingId: number, collaborator: string): ClarityResponse<Collaborator | null> {
    const key = `${listingId}-${collaborator}`;
    return { ok: true, value: this.state.listingCollaborators.get(key) ?? null };
  }

  getListingUpdateHistory(listingId: number, version: number): ClarityResponse<UpdateHistory | null> {
    const key = `${listingId}-${version}`;
    return { ok: true, value: this.state.listingUpdateHistory.get(key) ?? null };
  }

  getListingRevenueShare(listingId: number, participant: string): ClarityResponse<RevenueShare | null> {
    const key = `${listingId}-${participant}`;
    return { ok: true, value: this.state.listingRevenueShares.get(key) ?? null };
  }

  getListingVerification(listingId: number): ClarityResponse<Verification | null> {
    return { ok: true, value: this.state.listingVerifications.get(listingId) ?? null };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.contractPaused };
  }

  getListingCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.listingCounter };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  ngo1: "ngo_wallet_1",
  ngo2: "ngo_wallet_2",
  collaborator: "collaborator_wallet",
};

describe("SurplusListing Contract", () => {
  let contract: SurplusListingMock;

  beforeEach(() => {
    contract = new SurplusListingMock();
    vi.resetAllMocks();
  });

  it("should create a new listing successfully", () => {
    const result = contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678", // 32 bytes
      100,
      200,
      "Surplus food items",
      500
    );
    expect(result).toEqual({ ok: true, value: 1 });

    const details = contract.getListingDetails(1);
    expect(details.ok).toBe(true);
    expect(details.value).toEqual(expect.objectContaining({
      seller: accounts.ngo1,
      quantity: 100,
      expiration: 200,
      description: "Surplus food items",
      price: 500,
      active: true,
      createdAt: 100,
      lastUpdated: 100,
    }));

    const status = contract.getListingStatus(1);
    expect(status).toEqual({ ok: true, value: { status: "available", visibility: true, notes: "" } });
  });

  it("should prevent creating listing with invalid quantity", () => {
    const result = contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      0,
      200,
      "Invalid quantity",
      500
    );
    expect(result).toEqual({ ok: false, value: 103 });
  });

  it("should prevent creating listing when paused", () => {
    contract.pauseContract(accounts.deployer);
    const result = contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "Paused",
      500
    );
    expect(result).toEqual({ ok: false, value: 110 });
  });

  it("should update an existing listing", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "Original",
      500
    );
    contract.advanceBlock(); // Simulate block advance

    const updateResult = contract.updateListing(
      accounts.ngo1,
      1,
      150,
      250,
      "Updated description",
      600
    );
    expect(updateResult).toEqual({ ok: true, value: true });

    const details = contract.getListingDetails(1);
    expect(details.value).toEqual(expect.objectContaining({
      quantity: 150,
      expiration: 250,
      description: "Updated description",
      price: 600,
      lastUpdated: 101,
    }));

    const history = contract.getListingUpdateHistory(1, 1);
    expect(history.value).toEqual(expect.objectContaining({
      updatedBy: accounts.ngo1,
      changes: "Updated quantity, expiration, description, price",
      timestamp: 101,
    }));
  });

  it("should prevent update by non-owner", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "Original",
      500
    );

    const updateResult = contract.updateListing(
      accounts.ngo2,
      1,
      150,
      250,
      "Unauthorized",
      600
    );
    expect(updateResult).toEqual({ ok: false, value: 107 });
  });

  it("should deactivate a listing", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "To deactivate",
      500
    );

    const deactivateResult = contract.deactivateListing(accounts.ngo1, 1);
    expect(deactivateResult).toEqual({ ok: true, value: true });

    const details = contract.getListingDetails(1);
    expect(details.value?.active).toBe(false);

    const status = contract.getListingStatus(1);
    expect(status.value?.status).toBe("inactive");
  });

  it("should add category to listing", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "With category",
      500
    );

    const addResult = contract.addCategory(
      accounts.ngo1,
      1,
      "food",
      ["organic", "non-perishable"]
    );
    expect(addResult).toEqual({ ok: true, value: true });

    const category = contract.getListingCategory(1);
    expect(category.value).toEqual({ category: "food", tags: ["organic", "non-perishable"] });
  });

  it("should update status", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "Status update",
      500
    );

    const updateResult = contract.updateStatus(
      accounts.ngo1,
      1,
      "reserved",
      false,
      "Reserved for partner"
    );
    expect(updateResult).toEqual({ ok: true, value: true });

    const status = contract.getListingStatus(1);
    expect(status.value).toEqual({ status: "reserved", visibility: false, notes: "Reserved for partner" });
  });

  it("should add collaborator", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "With collaborator",
      500
    );

    const addResult = contract.addCollaborator(
      accounts.ngo1,
      1,
      accounts.collaborator,
      "verifier",
      ["update", "verify"]
    );
    expect(addResult).toEqual({ ok: true, value: true });

    const collab = contract.getListingCollaborator(1, accounts.collaborator);
    expect(collab.value).toEqual(expect.objectContaining({
      role: "verifier",
      permissions: ["update", "verify"],
    }));
  });

  it("should set revenue share", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "With share",
      500
    );

    const setResult = contract.setRevenueShare(
      accounts.ngo1,
      1,
      accounts.collaborator,
      100 // 10.0%
    );
    expect(setResult).toEqual({ ok: true, value: true });

    const share = contract.getListingRevenueShare(1, accounts.collaborator);
    expect(share.value).toEqual({ percentage: 100, totalReceived: 0 });
  });

  it("should add verification by owner", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "To verify",
      500
    );

    const addResult = contract.addVerification(
      accounts.ngo1,
      1,
      "Verified authenticity"
    );
    expect(addResult).toEqual({ ok: true, value: true });

    const verif = contract.getListingVerification(1);
    expect(verif.value?.verifiedBy).toEqual([accounts.ngo1]);
    expect(verif.value?.verificationNotes).toBe("Verified authenticity");
  });

  it("should add verification by collaborator", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "To verify by collab",
      500
    );
    contract.addCollaborator(
      accounts.ngo1,
      1,
      accounts.collaborator,
      "verifier",
      ["verify"]
    );

    const addResult = contract.addVerification(
      accounts.collaborator,
      1,
      "Collaborator verification"
    );
    expect(addResult).toEqual({ ok: true, value: true });

    const verif = contract.getListingVerification(1);
    expect(verif.value?.verifiedBy).toEqual([accounts.collaborator]);
  });

  it("should prevent verification by unauthorized", () => {
    contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "Unauthorized verify",
      500
    );

    const addResult = contract.addVerification(
      accounts.ngo2,
      1,
      "Unauthorized"
    );
    expect(addResult).toEqual({ ok: false, value: 100 });
  });

  it("should pause and unpause contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: true });

    const createDuringPause = contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      100,
      200,
      "Paused create",
      500
    );
    expect(createDuringPause).toEqual({ ok: false, value: 110 });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
  });

  it("should set min quantity by owner", () => {
    const setResult = contract.setMinQuantity(accounts.deployer, 10);
    expect(setResult).toEqual({ ok: true, value: true });

    const createLow = contract.createListing(
      accounts.ngo1,
      "itemhash1234567890123456789012345678",
      5,
      200,
      "Low quantity",
      500
    );
    expect(createLow).toEqual({ ok: false, value: 103 });
  });
});