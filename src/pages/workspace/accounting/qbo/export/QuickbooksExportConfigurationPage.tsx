import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import type {MenuItemProps} from '@components/MenuItem';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import withPolicy from '@pages/workspace/withPolicy';
import type {WithPolicyProps} from '@pages/workspace/withPolicy';
import * as Link from '@userActions/Link';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';

function QuickbooksExportConfigurationPage({policy}: WithPolicyProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const policyID = policy?.id ?? '';
    const policyOwner = policy?.owner ?? '';
    const {exporter, exportDate, exportEntity, exportInvoice, exportCompanyCard, errors} = policy?.connections?.quickbooksOnline?.config ?? {};
    const menuItems: MenuItemProps[] = [
        {
            description: translate('workspace.qbo.preferredExporter'),
            onPress: () => Navigation.navigate(ROUTES.WORKSPACE_ACCOUNTING_QUICKBOOKS_ONLINE_PREFERRED_EXPORTER.getRoute(policyID)),
            brickRoadIndicator: errors?.exporter ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            title: exporter ?? policyOwner,
        },
        {
            description: translate('workspace.qbo.date'),
            onPress: () => Navigation.navigate(ROUTES.WORKSPACE_ACCOUNTING_QUICKBOOKS_ONLINE_EXPORT_DATE_SELECT.getRoute(policyID)),
            brickRoadIndicator: errors?.exportDate ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            title: exportDate ? translate(`workspace.qbo.${exportDate}.label`) : undefined,
        },
        {
            description: translate('workspace.qbo.exportExpenses'),
            onPress: () => Navigation.navigate(ROUTES.WORKSPACE_ACCOUNTING_QUICKBOOKS_ONLINE_EXPORT_OUT_OF_POCKET_EXPENSES.getRoute(policyID)),
            brickRoadIndicator: errors?.exportExpenses ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            title: exportEntity ? translate(`workspace.qbo.${exportEntity}`) : undefined,
        },
        {
            description: translate('workspace.qbo.exportInvoices'),
            onPress: () => Navigation.navigate(ROUTES.WORKSPACE_ACCOUNTING_QUICKBOOKS_ONLINE_INVOICE_ACCOUNT_SELECT.getRoute(policyID)),
            brickRoadIndicator: errors?.exportInvoice ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            title: exportInvoice,
        },
        {
            description: translate('workspace.qbo.exportCompany'),
            onPress: () => Navigation.navigate(ROUTES.WORKSPACE_ACCOUNTING_QUICKBOOKS_ONLINE_COMPANY_CARD_EXPENSE.getRoute(policyID)),
            brickRoadIndicator: errors?.exportCompanyCard ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined,
            title: exportCompanyCard,
        },
        {
            description: translate('workspace.qbo.exportExpensifyCard'),
            title: translate('workspace.qbo.creditCard'),
            shouldShowRightIcon: false,
        },
    ];

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            testID={QuickbooksExportConfigurationPage.displayName}
        >
            <HeaderWithBackButton title={translate('workspace.qbo.export')} />
            <ScrollView contentContainerStyle={styles.pb2}>
                <Text style={[styles.ph5, styles.pb5]}>{translate('workspace.qbo.exportDescription')}</Text>
                {menuItems.map((menuItem) => (
                    <OfflineWithFeedback key={menuItem.description}>
                        <MenuItemWithTopDescription
                            title={menuItem.title}
                            interactive={menuItem?.interactive ?? true}
                            description={menuItem.description}
                            shouldShowRightIcon={menuItem?.shouldShowRightIcon ?? true}
                            onPress={menuItem?.onPress}
                            brickRoadIndicator={menuItem.brickRoadIndicator}
                        />
                    </OfflineWithFeedback>
                ))}
                <Text style={[styles.optionAlternateText, styles.ph5, styles.pb5, styles.mt2]}>
                    <Text style={[styles.optionAlternateText, styles.textLabelSupporting]}>{`${translate('workspace.qbo.deepDiveExpensifyCard')} `}</Text>
                    <TextLink
                        onPress={() => Link.openExternalLink(CONST.DEEP_DIVE_EXPENSIFY_CARD)}
                        style={[styles.optionAlternateText, styles.textLabelSupporting, styles.link]}
                    >
                        {translate('workspace.qbo.deepDiveExpensifyCardIntegration')}
                    </TextLink>
                </Text>
            </ScrollView>
        </ScreenWrapper>
    );
}

QuickbooksExportConfigurationPage.displayName = 'QuickbooksExportConfigurationPage';

export default withPolicy(QuickbooksExportConfigurationPage);
