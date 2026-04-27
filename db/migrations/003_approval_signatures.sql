-- 4-eyes approval workflow: every admin sign-off / rejection lives here.
-- The parent approval_requests.status is derived from these signatures
-- (computed in backend/src/lib/approvalState.ts).

CREATE TABLE approval_signatures (
  id                  CHAR(36) PRIMARY KEY,
  approval_request_id CHAR(36) NOT NULL,
  admin_email         VARCHAR(255) NOT NULL,
  admin_site          VARCHAR(255) NOT NULL,
  decision            ENUM('APPROVE','REJECT') NOT NULL,
  signed_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comment             TEXT,
  CONSTRAINT fk_signatures_request FOREIGN KEY (approval_request_id)
    REFERENCES approval_requests(id) ON DELETE CASCADE,
  CONSTRAINT uq_signatures_request_admin UNIQUE (approval_request_id, admin_email)
);

CREATE INDEX idx_signatures_request ON approval_signatures(approval_request_id);
CREATE INDEX idx_signatures_decision ON approval_signatures(decision);
