"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/ui/alert-modal";
import { useI18n } from "@/contexts/i18n-context";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const titleText = title ?? t("confirm.title");
  const confirmBtnText = confirmText ?? t("confirm.confirm");
  const cancelBtnText = cancelText ?? t("confirm.cancel");
  return (
    <AlertModal
      open={open}
      onOpenChange={onOpenChange}
      title={titleText}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{cancelBtnText}</Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmBtnText}
          </Button>
        </>
      }
    />
  );
}

export function InfoDialog({
  open,
  title,
  description,
  okText,
  onOpenChange,
}: {
  open: boolean;
  title?: string;
  description?: string;
  okText?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const titleText = title ?? t("info.title");
  const ok = okText ?? t("info.ok");
  return (
    <AlertModal
      open={open}
      onOpenChange={onOpenChange}
      title={titleText}
      description={description}
      footer={<Button variant="outline" onClick={() => onOpenChange(false)}>{ok}</Button>}
    />
  );
}
