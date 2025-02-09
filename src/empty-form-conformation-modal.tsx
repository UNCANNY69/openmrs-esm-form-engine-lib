import React from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import styles from './empty-formconformation-modal.scss'

interface EmptyFormConfirmationModalProps {
  onDiscard: () => void;
  onConfirmation: () => void;
  open: boolean;
}

const IncompleteFormConfirmationModal: React.FC<EmptyFormConfirmationModalProps> = ({
  onDiscard,
  onConfirmation,
  open,
}) => {
  const { t } = useTranslation();

  return (
    <ComposedModal open={open} onClose={onDiscard} className={styles.customModal}  size="small">
      <ModalHeader title={t('EmptyForm', 'Empty Form ')}  />
      <ModalBody>
        <p >
          {t(
            'EmptyFormConfirmation',
            'All fields are Empty. Are you sure you want to submit the form?',
          )}
        </p>
      </ModalBody>
      <ModalFooter >
        <Button kind="secondary" onClick={onDiscard}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={onConfirmation}>
          {t('confirm', 'Confirm')}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
};

export default IncompleteFormConfirmationModal;
