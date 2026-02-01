"use client";

import React from "react";
import { Card, CardBody } from "./Card";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-3">
          <div className="text-lg font-bold text-neutral-900">{title}</div>
          {description ? <div className="text-sm text-neutral-600">{description}</div> : null}

          <div className="pt-2 flex gap-2 justify-end">
            <Button variant="secondary" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
