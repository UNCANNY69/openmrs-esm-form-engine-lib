import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { type FormField, type FormSchema, type SessionMode } from '../types';
import { EncounterFormProcessor } from '../processors/encounter/encounter-form-processor';
import {
  type LayoutType,
  useLayoutType,
  type OpenmrsResource,
  showSnackbar,
  showToast,
  type ToastDescriptor,
} from '@openmrs/esm-framework';
import { type FormProcessorConstructor } from '../processors/form-processor';
import { type FormContextProps } from './form-provider';
import { processPostSubmissionActions, validateForm, validateEmptyFields } from './form-factory-helper';
import { useTranslation } from 'react-i18next';
import { usePostSubmissionActions } from '../hooks/usePostSubmissionActions';
import IncompleteFormConfirmationModal from '../empty-form-conformation-modal';

interface FormFactoryProviderContextProps {
  patient: fhir.Patient;
  sessionMode: SessionMode;
  sessionDate: Date;
  formJson: FormSchema;
  formProcessors: Record<string, FormProcessorConstructor>;
  layoutType: LayoutType;
  workspaceLayout: 'minimized' | 'maximized';
  visit: OpenmrsResource;
  location: OpenmrsResource;
  provider: OpenmrsResource;
  isFormExpanded: boolean;
  registerForm: (formId: string, isSubForm: boolean, context: FormContextProps) => void;
  handleConfirmQuestionDeletion?: (question: Readonly<FormField>) => Promise<void>;
  setIsFormDirty: (isFormDirty: boolean) => void;
}

interface FormFactoryProviderProps {
  patient: fhir.Patient;
  sessionMode: SessionMode;
  sessionDate: Date;
  formJson: FormSchema;
  workspaceLayout: 'minimized' | 'maximized';
  location: OpenmrsResource;
  provider: OpenmrsResource;
  visit: OpenmrsResource;
  isFormExpanded: boolean;
  children: React.ReactNode;
  formSubmissionProps: {
    isSubmitting: boolean;
    setIsSubmitting: (isSubmitting: boolean) => void;
    onSubmit: (data: any) => void;
    onError: (error: any) => void;
    handleClose: () => void;
  };
  hideFormCollapseToggle: () => void;
  handleConfirmQuestionDeletion?: (question: Readonly<FormField>) => Promise<void>;
  setIsFormDirty: (isFormDirty: boolean) => void;
}

const FormFactoryProviderContext = createContext<FormFactoryProviderContextProps | undefined>(undefined);

export const FormFactoryProvider: React.FC<FormFactoryProviderProps> = React.memo(({
  patient,
  sessionMode,
  sessionDate,
  formJson,
  workspaceLayout,
  location,
  provider,
  visit,
  isFormExpanded = true,
  children,
  formSubmissionProps,
  hideFormCollapseToggle,
  handleConfirmQuestionDeletion,
  setIsFormDirty,
}) => {
  const { t } = useTranslation();
  const rootForm = useRef<FormContextProps>();
  const subForms = useRef<Record<string, FormContextProps>>({});
  const layoutType = useLayoutType();
  const { isSubmitting, setIsSubmitting, onSubmit, onError, handleClose } = formSubmissionProps;
  const postSubmissionHandlers = usePostSubmissionActions(formJson.postSubmissionActions);
  const [isEmptyFormModalOpen, setIsEmptyFormModalOpen] = useState(false);

  const abortController = new AbortController();

  const handleFormSubmission = useCallback(
    async (forms: FormContextProps[]) => {
      try {
        const results = await Promise.all(
          forms.map((formContext) => formContext.processor.processSubmission(formContext, abortController)),
        );
  
        formSubmissionProps.setIsSubmitting(false);

        if (sessionMode === 'edit') {
          showSnackbar({
            title: t('updatedRecord', 'Record updated'),
            subtitle: t('updatedRecordDescription', 'The patient encounter was updated'),
            kind: 'success',
            isLowContrast: true,
          });
        } else {
          showSnackbar({
            title: t('submittedForm', 'Form submitted'),
            subtitle: t('submittedFormDescription', 'Form submitted successfully'),
            kind: 'success',
            isLowContrast: true,
          });
        }

        if (postSubmissionHandlers) {
          await processPostSubmissionActions(postSubmissionHandlers, results, patient, sessionMode, t);
        }
  
        hideFormCollapseToggle();
        if (onSubmit) {
          onSubmit(results);
        } else {
          handleClose();
        }
      } catch (errorObject: Error | ToastDescriptor | any) {
        setIsSubmitting(false);
        if (errorObject instanceof Error) {
          showToast({
            title: t('errorProcessingFormSubmission', 'Error processing form submission'),
            kind: 'error',
            description: errorObject.message,
            critical: true,
          });
        } else {
          showToast(errorObject);
        }
      }
    },
    [
      abortController,
      formSubmissionProps,
      sessionMode,
      t,
      postSubmissionHandlers,
      patient,
      hideFormCollapseToggle,
      onSubmit,
      handleClose,
    ],
  );

  const registerForm = useCallback((formId: string, isSubForm: boolean, context: FormContextProps) => {
    if (isSubForm) {
      subForms.current[formId] = context;
    } else {
      rootForm.current = context;
    }
  }, []);

  // TODO: Manage and load processors from the registry
  const formProcessors = useRef<Record<string, FormProcessorConstructor>>({
    EncounterFormProcessor: EncounterFormProcessor,
  });

  const handleIncompleteFormConfirmation = useCallback(() => {
    const forms = [rootForm.current, ...Object.values(subForms.current)];
    handleFormSubmission(forms); // To Use the reusable function
    setIsEmptyFormModalOpen(false);
  }, [handleFormSubmission]);

  const handleIncompleteFormDiscard = useCallback(() => {
    setIsEmptyFormModalOpen(false);
    setIsSubmitting(false);
  }, [setIsSubmitting]);

  useEffect(() => {
    if (isSubmitting) {
      const forms = [rootForm.current, ...Object.values(subForms.current)];
      const isValid = forms.every((formContext) => validateForm(formContext));
      const isEmpty = forms.some((formContext) => validateEmptyFields(formContext));
  
      if (isValid) {
        if (isEmpty) {
          setIsEmptyFormModalOpen(true); 
        } else {
          handleFormSubmission(forms);
        }
      } else {
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, handleFormSubmission]);

  return (
    <FormFactoryProviderContext.Provider
      value={{
        patient,
        sessionMode,
        sessionDate,
        formJson,
        formProcessors: formProcessors.current,
        layoutType,
        workspaceLayout,
        visit,
        location,
        provider,
        isFormExpanded,
        registerForm,
        handleConfirmQuestionDeletion,
        setIsFormDirty,
      }}>
      {isEmptyFormModalOpen && (
        <IncompleteFormConfirmationModal
          open={isEmptyFormModalOpen}
          onDiscard={handleIncompleteFormDiscard}
          onConfirmation={handleIncompleteFormConfirmation}
        />
      )}
      {formProcessors.current && children}
    </FormFactoryProviderContext.Provider>
  );
});

export const useFormFactory = () => {
  const context = useContext(FormFactoryProviderContext);
  if (!context) {
    throw new Error('useFormFactoryContext must be used within a FormFactoryProvider');
  }
  return context;
};
