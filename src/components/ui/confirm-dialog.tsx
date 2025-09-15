"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/ui/alert-modal";

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
  title = "Подтвердите действие",
  description,
  confirmText = "Удалить",
  cancelText = "Отмена",
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{cancelText}</Button>
          <Button
            variant="destructive"
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    />
  );
}

export function InfoDialog({
  open,
  title = "Информация",
  description,
  okText = "Понятно",
  onOpenChange,
}: {
  open: boolean;
  title?: string;
  description?: string;
  okText?: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={<Button variant="outline" onClick={() => onOpenChange(false)}>{okText}</Button>}
    />
  );
}
