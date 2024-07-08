import {ExpensiMark} from 'expensify-common';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import RenderHTML from '@components/RenderHTML';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useNetSuiteCustomFieldAddFormSubmit from '@hooks/useNetSuiteCustomFieldAddFormSubmit';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ValidationUtils from '@libs/ValidationUtils';
import type {CustomFieldSubStepWithPolicy} from '@pages/workspace/accounting/netsuite/types';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/NetSuiteCustomFieldForm';

const parser = new ExpensiMark();

function TransactionFieldIDStep({onNext, isEditing, policy}: CustomFieldSubStepWithPolicy) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const handleSubmit = useNetSuiteCustomFieldAddFormSubmit({
        fieldIds: [INPUT_IDS.TRANSACTION_FIELD_ID],
        onNext,
        shouldSaveDraft: isEditing,
    });

    const fieldLabel = translate(`workspace.netsuite.import.importCustomFields.customLists.fields.transactionFieldID`);

    const validate = useCallback(
        (values: FormOnyxValues<typeof ONYXKEYS.FORMS.NETSUITE_CUSTOM_FIELD_ADD_FORM>): FormInputErrors<typeof ONYXKEYS.FORMS.NETSUITE_CUSTOM_FIELD_ADD_FORM> => {
            const errors: FormInputErrors<typeof ONYXKEYS.FORMS.NETSUITE_CUSTOM_FIELD_ADD_FORM> = {};

            if (!ValidationUtils.isRequiredFulfilled(values[INPUT_IDS.TRANSACTION_FIELD_ID])) {
                errors[INPUT_IDS.TRANSACTION_FIELD_ID] = translate('workspace.netsuite.import.importCustomFields.requiredFieldError', fieldLabel);
            } else if (
                policy?.connections?.netsuite?.options?.config?.syncOptions?.customLists?.find(
                    (customList) => customList.transactionFieldID.toLowerCase() === values[INPUT_IDS.TRANSACTION_FIELD_ID].toLocaleLowerCase(),
                )
            ) {
                errors[INPUT_IDS.TRANSACTION_FIELD_ID] = translate('workspace.netsuite.import.importCustomFields.uniqueTransactionFieldIdError');
            }

            return errors;
        },
        [fieldLabel, policy?.connections?.netsuite?.options?.config?.syncOptions?.customLists, translate],
    );

    return (
        <FormProvider
            formID={ONYXKEYS.FORMS.NETSUITE_CUSTOM_FIELD_ADD_FORM}
            submitButtonText={translate('common.next')}
            onSubmit={handleSubmit}
            validate={validate}
            style={[styles.flexGrow1, styles.ph5]}
            submitButtonStyles={[styles.mb0]}
        >
            <Text style={[styles.mb3, styles.textHeadlineLineHeightXXL]}>{translate(`workspace.netsuite.import.importCustomFields.customLists.addForm.transactionFieldIDTitle`)}</Text>
            <InputWrapper
                InputComponent={TextInput}
                inputID={INPUT_IDS.TRANSACTION_FIELD_ID}
                shouldSaveDraft={!isEditing}
                label={fieldLabel}
                aria-label={fieldLabel}
                role={CONST.ROLE.PRESENTATION}
                spellCheck={false}
            />
            <View style={[styles.flex1, styles.mv3, styles.renderHTML, styles.textDecorationSkipInkNone]}>
                <RenderHTML html={`<comment>${parser.replace(translate(`workspace.netsuite.import.importCustomFields.customLists.addForm.transactionFieldIDFooter`))}</comment>`} />
            </View>
        </FormProvider>
    );
}

TransactionFieldIDStep.displayName = 'TransactionFieldIDStep';
export default TransactionFieldIDStep;
