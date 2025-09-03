;; SurplusListing.clar
;; Core contract for listing and managing surplus aid items in the AidShare marketplace.
;; This contract handles the creation, updating, querying, and management of surplus aid listings by verified NGOs.
;; It ensures authenticity via hashes, tracks quantities and expirations, and includes advanced features like categories,
;; status updates, collaborators, revenue shares for potential fees, and version history for listing updates.

;; Constants for error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-LISTING u101)
(define-constant ERR-ALREADY-EXISTS u102)
(define-constant ERR-INVALID-QUANTITY u103)
(define-constant ERR-INVALID-EXPIRATION u104)
(define-constant ERR-INVALID-PRICE u105)
(define-constant ERR-LISTING-INACTIVE u106)
(define-constant ERR-NOT-OWNER u107)
(define-constant ERR-MAX-CATEGORIES-REACHED u108)
(define-constant ERR-INVALID-METADATA u109)
(define-constant ERR-PAUSED u110)

;; Data variables
(define-data-var contract-owner principal tx-sender)
(define-data-var contract-paused bool false)
(define-data-var listing-counter uint u0)
(define-data-var min-quantity uint u1)
(define-data-var max-description-length uint u1000)
(define-data-var fee-percentage uint u5) ;; 0.5% fee example, but stored as u5 for 0.5%

;; Data maps
(define-map listings
  { listing-id: uint }
  {
    seller: principal,
    item-hash: (buff 32), ;; SHA-256 hash of item manifest for authenticity
    quantity: uint,
    expiration: uint, ;; Block height or timestamp for expiration
    description: (string-utf8 1000),
    price: uint, ;; In AID tokens
    active: bool,
    created-at: uint,
    last-updated: uint
  }
)

(define-map listing-categories
  { listing-id: uint }
  {
    category: (string-utf8 50), ;; e.g., "food", "medicine"
    tags: (list 20 (string-utf8 30)) ;; Up to 20 tags
  }
)

(define-map listing-status
  { listing-id: uint }
  {
    status: (string-utf8 20), ;; e.g., "available", "reserved", "sold"
    visibility: bool, ;; Public or private
    notes: (string-utf8 500)
  }
)

(define-map listing-collaborators
  { listing-id: uint, collaborator: principal }
  {
    role: (string-utf8 50), ;; e.g., "verifier", "logistician"
    permissions: (list 5 (string-utf8 20)), ;; e.g., "update", "deactivate"
    added-at: uint
  }
)

(define-map listing-update-history
  { listing-id: uint, version: uint }
  {
    updated-by: principal,
    changes: (string-utf8 500), ;; Description of changes
    timestamp: uint
  }
)

(define-map listing-revenue-shares
  { listing-id: uint, participant: principal }
  {
    percentage: uint, ;; Out of 1000 (for 0.1% precision)
    total-received: uint ;; In AID tokens
  }
)

(define-map listing-verifications
  { listing-id: uint }
  {
    verified-by: (list 5 principal), ;; Up to 5 verifiers
    verification-notes: (string-utf8 500),
    verified-at: uint
  }
)

;; Public functions

(define-public (create-listing (item-hash (buff 32)) (quantity uint) (expiration uint) (description (string-utf8 1000)) (price uint))
  (let
    (
      (new-id (+ (var-get listing-counter) u1))
      (sender tx-sender)
      (current-block block-height)
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (>= quantity (var-get min-quantity)) (err ERR-INVALID-QUANTITY))
    (asserts! (> expiration current-block) (err ERR-INVALID-EXPIRATION))
    (asserts! (> price u0) (err ERR-INVALID-PRICE))
    (asserts! (<= (len description) (var-get max-description-length)) (err ERR-INVALID-METADATA))
    ;; Assume NGO verification happens in NGORegistry; here we just proceed
    (map-set listings
      { listing-id: new-id }
      {
        seller: sender,
        item-hash: item-hash,
        quantity: quantity,
        expiration: expiration,
        description: description,
        price: price,
        active: true,
        created-at: current-block,
        last-updated: current-block
      }
    )
    (map-set listing-status
      { listing-id: new-id }
      {
        status: u"available",
        visibility: true,
        notes: u""
      }
    )
    (var-set listing-counter new-id)
    (ok new-id)
  )
)

(define-public (update-listing (listing-id uint) (new-quantity uint) (new-expiration uint) (new-description (string-utf8 1000)) (new-price uint))
  (let
    (
      (listing-opt (map-get? listings { listing-id: listing-id }))
      (sender tx-sender)
      (current-block block-height)
      (version (+ (len (map-get? listing-update-history { listing-id: listing-id })) u1)) ;; Simplified version count
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (match listing-opt listing
      (begin
        (asserts! (is-eq (get seller listing) sender) (err ERR-NOT-OWNER))
        (asserts! (get active listing) (err ERR-LISTING-INACTIVE))
        (asserts! (>= new-quantity (var-get min-quantity)) (err ERR-INVALID-QUANTITY))
        (asserts! (> new-expiration current-block) (err ERR-INVALID-EXPIRATION))
        (asserts! (> new-price u0) (err ERR-INVALID-PRICE))
        (asserts! (<= (len new-description) (var-get max-description-length)) (err ERR-INVALID-METADATA))
        (map-set listings
          { listing-id: listing-id }
          (merge listing {
            quantity: new-quantity,
            expiration: new-expiration,
            description: new-description,
            price: new-price,
            last-updated: current-block
          })
        )
        (map-set listing-update-history
          { listing-id: listing-id, version: version }
          {
            updated-by: sender,
            changes: u"Updated quantity, expiration, description, price",
            timestamp: current-block
          }
        )
        (ok true)
      )
      (err ERR-INVALID-LISTING)
    )
  )
)

(define-public (deactivate-listing (listing-id uint))
  (let
    (
      (listing-opt (map-get? listings { listing-id: listing-id }))
      (sender tx-sender)
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (match listing-opt listing
      (begin
        (asserts! (is-eq (get seller listing) sender) (err ERR-NOT-OWNER))
        (map-set listings
          { listing-id: listing-id }
          (merge listing { active: false })
        )
        (map-set listing-status
          { listing-id: listing-id }
          (merge (unwrap-panic (map-get? listing-status { listing-id: listing-id }))
            { status: u"inactive" }
          )
        )
        (ok true)
      )
      (err ERR-INVALID-LISTING)
    )
  )
)

(define-public (add-category (listing-id uint) (category (string-utf8 50)) (tags (list 20 (string-utf8 30))))
  (let
    (
      (listing-opt (map-get? listings { listing-id: listing-id }))
      (sender tx-sender)
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (match listing-opt listing
      (begin
        (asserts! (is-eq (get seller listing) sender) (err ERR-NOT-OWNER))
        (asserts! (get active listing) (err ERR-LISTING-INACTIVE))
        (asserts! (<= (len tags) u20) (err ERR-MAX-CATEGORIES-REACHED))
        (map-set listing-categories
          { listing-id: listing-id }
          { category: category, tags: tags }
        )
        (ok true)
      )
      (err ERR-INVALID-LISTING)
    )
  )
)

(define-public (update-status (listing-id uint) (new-status (string-utf8 20)) (visibility bool) (notes (string-utf8 500)))
  (let
    (
      (listing-opt (map-get? listings { listing-id: listing-id }))
      (sender tx-sender)
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (match listing-opt listing
      (begin
        (asserts! (is-eq (get seller listing) sender) (err ERR-NOT-OWNER))
        (asserts! (get active listing) (err ERR-LISTING-INACTIVE))
        (map-set listing-status
          { listing-id: listing-id }
          { status: new-status, visibility: visibility, notes: notes }
        )
        (ok true)
      )
      (err ERR-INVALID-LISTING)
    )
  )
)

(define-public (add-collaborator (listing-id uint) (collaborator principal) (role (string-utf8 50)) (permissions (list 5 (string-utf8 20))))
  (let
    (
      (listing-opt (map-get? listings { listing-id: listing-id }))
      (sender tx-sender)
      (current-block block-height)
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (match listing-opt listing
      (begin
        (asserts! (is-eq (get seller listing) sender) (err ERR-NOT-OWNER))
        (asserts! (get active listing) (err ERR-LISTING-INACTIVE))
        (map-set listing-collaborators
          { listing-id: listing-id, collaborator: collaborator }
          { role: role, permissions: permissions, added-at: current-block }
        )
        (ok true)
      )
      (err ERR-INVALID-LISTING)
    )
  )
)

(define-public (set-revenue-share (listing-id uint) (participant principal) (percentage uint))
  (let
    (
      (listing-opt (map-get? listings { listing-id: listing-id }))
      (sender tx-sender)
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (match listing-opt listing
      (begin
        (asserts! (is-eq (get seller listing) sender) (err ERR-NOT-OWNER))
        (asserts! (get active listing) (err ERR-LISTING-INACTIVE))
        (asserts! (<= percentage u1000) (err ERR-INVALID-PRICE)) ;; Max 100.0%
        (map-set listing-revenue-shares
          { listing-id: listing-id, participant: participant }
          { percentage: percentage, total-received: u0 }
        )
        (ok true)
      )
      (err ERR-INVALID-LISTING)
    )
  )
)

(define-public (add-verification (listing-id uint) (notes (string-utf8 500)))
  (let
    (
      (listing-opt (map-get? listings { listing-id: listing-id }))
      (sender tx-sender)
      (current-block block-height)
      (current-verifs (map-get? listing-verifications { listing-id: listing-id }))
    )
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (match listing-opt listing
      (begin
        ;; Assume sender has permission (e.g., collaborator or owner)
        (asserts! (or (is-eq (get seller listing) sender)
                      (is-some (map-get? listing-collaborators { listing-id: listing-id, collaborator: sender })))
                  (err ERR-NOT-AUTHORIZED))
        (asserts! (get active listing) (err ERR-LISTING-INACTIVE))
        (let
          (
            (verifiers (default-to (list) (get verified-by current-verifs)))
            (new-verifiers (append verifiers sender))
          )
          (asserts! (<= (len new-verifiers) u5) (err ERR-MAX-CATEGORIES-REACHED))
          (map-set listing-verifications
            { listing-id: listing-id }
            { verified-by: new-verifiers, verification-notes: notes, verified-at: current-block }
          )
          (ok true)
        )
      )
      (err ERR-INVALID-LISTING)
    )
  )
)

;; Admin functions
(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (set-min-quantity (new-min uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (var-set min-quantity new-min)
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-listing-details (listing-id uint))
  (map-get? listings { listing-id: listing-id })
)

(define-read-only (get-listing-category (listing-id uint))
  (map-get? listing-categories { listing-id: listing-id })
)

(define-read-only (get-listing-status (listing-id uint))
  (map-get? listing-status { listing-id: listing-id })
)

(define-read-only (get-listing-collaborator (listing-id uint) (collaborator principal))
  (map-get? listing-collaborators { listing-id: listing-id, collaborator: collaborator })
)

(define-read-only (get-listing-update-history (listing-id uint) (version uint))
  (map-get? listing-update-history { listing-id: listing-id, version: version })
)

(define-read-only (get-listing-revenue-share (listing-id uint) (participant principal))
  (map-get? listing-revenue-shares { listing-id: listing-id, participant: participant })
)

(define-read-only (get-listing-verification (listing-id uint))
  (map-get? listing-verifications { listing-id: listing-id })
)

(define-read-only (is-paused)
  (var-get contract-paused)
)

(define-read-only (get-listing-counter)
  (var-get listing-counter)
)