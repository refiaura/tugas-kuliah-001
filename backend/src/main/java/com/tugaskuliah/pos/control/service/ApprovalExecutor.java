package com.tugaskuliah.pos.control.service;

import com.tugaskuliah.pos.control.entity.Approval;

/**
 * Side effect executed when an approval is APPROVED (the request itself is
 * already marked APPROVED by {@link ApprovalService} before this runs).
 */
public interface ApprovalExecutor {

    Approval.SubjectType subjectType();

    void execute(Approval approval);
}
