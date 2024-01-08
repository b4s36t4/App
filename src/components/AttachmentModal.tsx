import Str from 'expensify-common/lib/str';
import lodashExtend from 'lodash/extend';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Animated, Keyboard, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import addEncryptedAuthTokenToURL from '@libs/addEncryptedAuthTokenToURL';
import fileDownload from '@libs/fileDownload';
import * as FileUtils from '@libs/fileDownload/FileUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as TransactionUtils from '@libs/TransactionUtils';
import useNativeDriver from '@libs/useNativeDriver';
import type {AvatarSource} from '@libs/UserUtils';
import * as IOU from '@userActions/IOU';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import {isNotEmptyObject} from '@src/types/utils/EmptyObject';
import AttachmentCarousel from './Attachments/AttachmentCarousel';
import AttachmentView from './Attachments/AttachmentView';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import HeaderGap from './HeaderGap';
import HeaderWithBackButton from './HeaderWithBackButton';
import * as Expensicons from './Icon/Expensicons';
import Modal from './Modal';
import SafeAreaConsumer from './SafeAreaConsumer';

/**
 * Modal render prop component that exposes modal launching triggers that can be used
 * to display a full size image or PDF modally with optional confirmation button.
 */

type AttachmentModalOnyxProps = {
    /** The transaction associated with the receipt attachment, if any */
    transaction: OnyxEntry<OnyxTypes.Transaction>;

    /** The report associated with the receipt attachment, if any */
    parentReport: OnyxEntry<OnyxTypes.Report>;

    /** The policy associated with the receipt attachment, if any */
    policy: OnyxEntry<OnyxTypes.Policy>;

    /** The list of report actions associated with the receipt attachment, if any */
    parentReportActions: OnyxEntry<OnyxTypes.ReportActions>;

    /** Current user session */
    // eslint-disable-next-line react/no-unused-prop-types
    session: OnyxEntry<OnyxTypes.Session>;
};

type Attachment = {
    source: string;
    isAuthTokenRequired: boolean;
    file: File;
    isReceipt: boolean;
};

type ImagePickerResponse = {
    height: number;
    name: string;
    size: number;
    type: string;
    uri: string;
    width: number;
};

type Data = File | ImagePickerResponse;

type ChildrenProps = {
    displayFileInModal: (data: Data) => void;
    show: () => void;
};

type AttachmentModalProps = AttachmentModalOnyxProps & {
    /** Optional source (URL, SVG function) for the image shown. If not passed in via props must be specified when modal is opened. */
    source?: string;

    /** Optional callback to fire when we want to preview an image and approve it for use. */
    onConfirm?: ((file: Partial<File>) => void) | null;

    /** Whether the modal should be open by default */
    defaultOpen?: boolean;

    /** Optional original filename when uploading */
    originalFileName?: string;

    /** Whether source url requires authentication */
    isAuthTokenRequired?: boolean;

    /** Determines if download Button should be shown or not */
    allowDownload?: boolean;

    /** Title shown in the header of the modal */
    headerTitle?: string;

    /** The report that has this attachment */
    report?: OnyxTypes.Report;

    /** Optional callback to fire when we want to do something after modal show. */
    onModalShow?: () => void;

    /** Optional callback to fire when we want to do something after modal hide. */
    onModalHide?: () => void;

    /** Optional callback to fire when we want to do something after attachment carousel changes. */
    onCarouselAttachmentChange?: (attachment: Attachment) => void;

    /** Denotes whether it is a workspace avatar or not */
    isWorkspaceAvatar?: boolean;

    /** Whether it is a receipt attachment or not */
    isReceiptAttachment?: boolean;

    /** A function as a child to pass modal launching methods to */
    children?: React.FC<ChildrenProps>;

    fallbackSource?: AvatarSource | number;
};

function AttachmentModal({
    source = '',
    onConfirm = null,
    defaultOpen = false,
    originalFileName = '',
    isAuthTokenRequired = false,
    allowDownload = false,
    report,
    onModalShow = () => {},
    onModalHide = () => {},
    onCarouselAttachmentChange = () => {},
    isReceiptAttachment = false,
    isWorkspaceAvatar = false,
    transaction,
    parentReport,
    parentReportActions,
    headerTitle,
    policy,
    children,
    fallbackSource,
}: AttachmentModalProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const [isModalOpen, setIsModalOpen] = useState(defaultOpen);
    const [shouldLoadAttachment, setShouldLoadAttachment] = useState(false);
    const [isAttachmentInvalid, setIsAttachmentInvalid] = useState(false);

    const [isDeleteReceiptConfirmModalVisible, setIsDeleteReceiptConfirmModalVisible] = useState(false);
    const [isAuthTokenRequiredState, setIsAuthTokenRequiredState] = useState(isAuthTokenRequired);
    const [attachmentInvalidReasonTitle, setAttachmentInvalidReasonTitle] = useState('');
    const [attachmentInvalidReason, setAttachmentInvalidReason] = useState<string | null>(null);
    const [sourceState, setSourceState] = useState(source);
    const [modalType, setModalType] = useState<ValueOf<typeof CONST.MODAL.MODAL_TYPE>>(CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE);
    const [isConfirmButtonDisabled, setIsConfirmButtonDisabled] = useState(false);
    const [confirmButtonFadeAnimation] = useState(() => new Animated.Value(1));
    const [isDownloadButtonReadyToBeShown, setIsDownloadButtonReadyToBeShown] = React.useState(true);
    const {windowWidth, isSmallScreenWidth} = useWindowDimensions();
    const isOverlayModalVisible = (isReceiptAttachment && isDeleteReceiptConfirmModalVisible) || (!isReceiptAttachment && isAttachmentInvalid);

    const [file, setFile] = useState<Partial<File> | undefined>(
        originalFileName
            ? {
                  name: originalFileName,
              }
            : undefined,
    );
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();

    useEffect(() => {
        setFile(originalFileName ? {name: originalFileName} : undefined);
    }, [originalFileName]);

    /**
     * Keeps the attachment source in sync with the attachment displayed currently in the carousel.
     * @param {{ source: String, isAuthTokenRequired: Boolean, file: { name: string }, isReceipt: Boolean }} attachment
     */
    const onNavigate = useCallback(
        (attachment: Attachment) => {
            setSourceState(attachment.source);
            setFile(attachment.file);
            setIsAuthTokenRequiredState(attachment.isAuthTokenRequired);
            onCarouselAttachmentChange(attachment);
        },
        [onCarouselAttachmentChange],
    );

    /**
     * If our attachment is a PDF, return the unswipeablge Modal type.
     * @param {String} sourceURL
     * @param {Object} _file
     * @returns {String}
     */
    const getModalType = useCallback(
        // eslint-disable-next-line @typescript-eslint/naming-convention
        (sourceURL: string, _file: File | ImagePickerResponse) =>
            sourceURL && (Str.isPDF(sourceURL) || (_file && Str.isPDF(_file.name || translate('attachmentView.unknownFilename'))))
                ? CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE
                : CONST.MODAL.MODAL_TYPE.CENTERED,
        [translate],
    );

    const setDownloadButtonVisibility = useCallback(
        (isButtonVisible: boolean) => {
            if (isDownloadButtonReadyToBeShown === isButtonVisible) {
                return;
            }
            setIsDownloadButtonReadyToBeShown(isButtonVisible);
        },
        [isDownloadButtonReadyToBeShown],
    );

    /**
     * Download the currently viewed attachment.
     */
    const downloadAttachment = useCallback(() => {
        let sourceURL = sourceState;
        if (isAuthTokenRequiredState) {
            sourceURL = addEncryptedAuthTokenToURL(sourceURL ?? '');
        }

        fileDownload(sourceURL, file?.name ?? '');

        // At ios, if the keyboard is open while opening the attachment, then after downloading
        // the attachment keyboard will show up. So, to fix it we need to dismiss the keyboard.
        Keyboard.dismiss();
    }, [isAuthTokenRequiredState, sourceState, file]);

    /**
     * Execute the onConfirm callback and close the modal.
     */
    const submitAndClose = useCallback(() => {
        // If the modal has already been closed or the confirm button is disabled
        // do not submit.
        if (!isModalOpen || isConfirmButtonDisabled) {
            return;
        }
        if (onConfirm) {
            onConfirm(lodashExtend(file, {source: sourceState}));
        }

        setIsModalOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalOpen, isConfirmButtonDisabled, onConfirm, file, sourceState]);

    /**
     * Close the confirm modals.
     */
    const closeConfirmModal = useCallback(() => {
        setIsAttachmentInvalid(false);
        setIsDeleteReceiptConfirmModalVisible(false);
    }, []);

    /**
     * Detach the receipt and close the modal.
     */
    const deleteAndCloseModal = useCallback(() => {
        IOU.detachReceipt(transaction?.transactionID);
        setIsDeleteReceiptConfirmModalVisible(false);
        Navigation.dismissModal(report?.reportID);
    }, [transaction, report]);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const isValidFile = useCallback((_file: File) => {
        if ((_file.size ?? 0) > CONST.API_ATTACHMENT_VALIDATIONS.MAX_SIZE) {
            setIsAttachmentInvalid(true);
            setAttachmentInvalidReasonTitle('attachmentPicker.attachmentTooLarge');
            setAttachmentInvalidReason('attachmentPicker.sizeExceeded');
            return false;
        }

        if ((_file.size ?? 0) < CONST.API_ATTACHMENT_VALIDATIONS.MIN_SIZE) {
            setIsAttachmentInvalid(true);
            setAttachmentInvalidReasonTitle('attachmentPicker.attachmentTooSmall');
            setAttachmentInvalidReason('attachmentPicker.sizeNotMet');
            return false;
        }

        return true;
    }, []);
    /**
     * @param {Object} _data
     * @returns {Boolean}
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const isDirectoryCheck = useCallback((_data: Data) => {
        if ('webkitGetAsEntry' in _data && typeof _data.webkitGetAsEntry === 'function' && _data.webkitGetAsEntry()?.isDirectory) {
            setIsAttachmentInvalid(true);
            setAttachmentInvalidReasonTitle('attachmentPicker.attachmentError');
            setAttachmentInvalidReason('attachmentPicker.folderNotAllowedMessage');
            return false;
        }
        return true;
    }, []);

    /**
     * @param {Object} _data
     */
    const validateAndDisplayFileToUpload = useCallback(
        // eslint-disable-next-line @typescript-eslint/naming-convention
        (_data: Data) => {
            if (!isDirectoryCheck(_data)) {
                return;
            }
            let fileObject: Data | null = _data;
            if ('getAsFile' in _data && typeof _data.getAsFile === 'function') {
                fileObject = _data.getAsFile();
            }
            if (!fileObject) {
                return;
            }

            if (fileObject instanceof File && !isValidFile(fileObject)) {
                return;
            }

            if (fileObject instanceof File) {
                /**
                 * Cleaning file name, done here so that it covers all cases:
                 * upload, drag and drop, copy-paste
                 */
                let updatedFile = fileObject;
                const cleanName = FileUtils.cleanFileName(updatedFile.name);
                if (updatedFile.name !== cleanName) {
                    updatedFile = new File([updatedFile], cleanName, {type: updatedFile.type});
                }
                const inputSource = URL.createObjectURL(updatedFile);
                const inputModalType = getModalType(inputSource, updatedFile);
                setIsModalOpen(true);
                setSourceState(inputSource);
                setFile(updatedFile);
                setModalType(inputModalType);
            } else {
                const inputModalType = getModalType(fileObject.uri, fileObject);
                setIsModalOpen(true);
                setSourceState(fileObject.uri);
                setFile(fileObject);
                setModalType(inputModalType);
            }
        },
        [isValidFile, getModalType, isDirectoryCheck],
    );

    /**
     * In order to gracefully hide/show the confirm button when the keyboard
     * opens/closes, apply an animation to fade the confirm button out/in. And since
     * we're only updating the opacity of the confirm button, we must also conditionally
     * disable it.
     *
     * @param {Boolean} shouldFadeOut If true, fade out confirm button. Otherwise fade in.
     */
    const updateConfirmButtonVisibility = useCallback(
        (shouldFadeOut: boolean) => {
            setIsConfirmButtonDisabled(shouldFadeOut);
            const toValue = shouldFadeOut ? 0 : 1;

            Animated.timing(confirmButtonFadeAnimation, {
                toValue,
                duration: 100,
                useNativeDriver,
            }).start();
        },
        [confirmButtonFadeAnimation],
    );

    /**
     * close the modal
     */
    const closeModal = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    /**
     *  open the modal
     */
    const openModal = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    useEffect(() => {
        setSourceState(source);
    }, [source]);

    useEffect(() => {
        setIsAuthTokenRequiredState(isAuthTokenRequired);
    }, [isAuthTokenRequired]);

    const sourceForAttachmentView = sourceState ?? source;

    const threeDotsMenuItems = useMemo(() => {
        if (!isReceiptAttachment || !parentReport || !parentReportActions) {
            return [];
        }
        const menuItems = [];
        const parentReportAction = parentReportActions[report?.parentReportActionID ?? ''];

        const canEdit =
            ReportUtils.canEditFieldOfMoneyRequest(parentReportAction, parentReport.reportID, CONST.EDIT_REQUEST_FIELD.RECEIPT, transaction) &&
            !TransactionUtils.isDistanceRequest(transaction);
        if (canEdit) {
            menuItems.push({
                icon: Expensicons.Camera,
                text: translate('common.replace'),
                onSelected: () => {
                    closeModal();
                    Navigation.navigate(ROUTES.EDIT_REQUEST.getRoute(report?.reportID ?? '', CONST.EDIT_REQUEST_FIELD.RECEIPT));
                },
            });
        }
        menuItems.push({
            icon: Expensicons.Download,
            text: translate('common.download'),
            onSelected: () => downloadAttachment(),
        });
        if (TransactionUtils.hasReceipt(transaction) && !TransactionUtils.isReceiptBeingScanned(transaction) && canEdit) {
            menuItems.push({
                icon: Expensicons.Trashcan,
                text: translate('receipt.deleteReceipt'),
                onSelected: () => {
                    setIsDeleteReceiptConfirmModalVisible(true);
                },
            });
        }
        return menuItems;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReceiptAttachment, parentReport, parentReportActions, policy, transaction, file, sourceState]);

    // There are a few things that shouldn't be set until we absolutely know if the file is a receipt or an attachment.
    // props.isReceiptAttachment will be null until its certain what the file is, in which case it will then be true|false.
    let shouldShowDownloadButton = false;
    let shouldShowThreeDotsButton = false;
    if (isNotEmptyObject(report)) {
        shouldShowDownloadButton = allowDownload && isDownloadButtonReadyToBeShown && !isReceiptAttachment && !isOffline;
        shouldShowThreeDotsButton = isReceiptAttachment && isModalOpen;
    }

    return (
        <>
            <Modal
                type={modalType}
                onSubmit={submitAndClose}
                onClose={isOverlayModalVisible ? closeConfirmModal : closeModal}
                isVisible={isModalOpen}
                onModalShow={() => {
                    onModalShow();
                    setShouldLoadAttachment(true);
                }}
                onModalHide={() => {
                    onModalHide();
                    setShouldLoadAttachment(false);
                }}
                propagateSwipe
            >
                <GestureHandlerRootView style={styles.flex1}>
                    {isSmallScreenWidth && <HeaderGap />}
                    <HeaderWithBackButton
                        title={headerTitle}
                        shouldShowBorderBottom
                        shouldShowDownloadButton={shouldShowDownloadButton}
                        onDownloadButtonPress={() => downloadAttachment()}
                        shouldShowCloseButton={!isSmallScreenWidth}
                        shouldShowBackButton={isSmallScreenWidth}
                        onBackButtonPress={closeModal}
                        onCloseButtonPress={closeModal}
                        shouldShowThreeDotsButton={shouldShowThreeDotsButton}
                        threeDotsAnchorPosition={styles.threeDotsPopoverOffsetAttachmentModal(windowWidth)}
                        threeDotsMenuItems={threeDotsMenuItems}
                        shouldOverlay
                    />
                    <View style={styles.imageModalImageCenterContainer}>
                        {report && !isReceiptAttachment ? (
                            <AttachmentCarousel
                                report={report}
                                onNavigate={onNavigate}
                                source={source}
                                onClose={closeModal}
                                onToggleKeyboard={updateConfirmButtonVisibility}
                                setDownloadButtonVisibility={setDownloadButtonVisibility}
                            />
                        ) : (
                            Boolean(sourceForAttachmentView) &&
                            shouldLoadAttachment && (
                                <AttachmentView
                                    // @ts-expect-error TODO: Remove this once Attachments (https://github.com/Expensify/App/issues/24969) is migrated to TypeScript.
                                    containerStyles={[styles.mh5]}
                                    source={sourceForAttachmentView}
                                    isAuthTokenRequired={isAuthTokenRequired}
                                    file={file}
                                    onToggleKeyboard={updateConfirmButtonVisibility}
                                    isWorkspaceAvatar={isWorkspaceAvatar}
                                    fallbackSource={fallbackSource}
                                    isUsedInAttachmentModal
                                    transactionID={transaction?.transactionID}
                                />
                            )
                        )}
                    </View>
                    {/* If we have an onConfirm method show a confirmation button */}
                    {Boolean(onConfirm) && (
                        <SafeAreaConsumer>
                            {({safeAreaPaddingBottomStyle}) => (
                                <Animated.View style={[StyleUtils.fade(confirmButtonFadeAnimation), safeAreaPaddingBottomStyle]}>
                                    <Button
                                        success
                                        style={[styles.buttonConfirm, isSmallScreenWidth ? {} : styles.attachmentButtonBigScreen]}
                                        textStyles={[styles.buttonConfirmText]}
                                        text={translate('common.send')}
                                        onPress={submitAndClose}
                                        isDisabled={isConfirmButtonDisabled}
                                        pressOnEnter
                                    />
                                </Animated.View>
                            )}
                        </SafeAreaConsumer>
                    )}
                    {isReceiptAttachment && (
                        <ConfirmModal
                            title={translate('receipt.deleteReceipt')}
                            isVisible={isDeleteReceiptConfirmModalVisible}
                            onConfirm={deleteAndCloseModal}
                            onCancel={closeConfirmModal}
                            prompt={translate('receipt.deleteConfirmation')}
                            confirmText={translate('common.delete')}
                            cancelText={translate('common.cancel')}
                            danger
                        />
                    )}
                </GestureHandlerRootView>
            </Modal>
            {!isReceiptAttachment && (
                <ConfirmModal
                    title={attachmentInvalidReasonTitle ? translate(attachmentInvalidReasonTitle as TranslationPaths) : ''}
                    onConfirm={closeConfirmModal}
                    onCancel={closeConfirmModal}
                    isVisible={isAttachmentInvalid}
                    prompt={attachmentInvalidReason ? translate(attachmentInvalidReason as TranslationPaths) : ''}
                    confirmText={translate('common.close')}
                    shouldShowCancelButton={false}
                />
            )}

            {children &&
                typeof children === 'function' &&
                children({
                    displayFileInModal: validateAndDisplayFileToUpload,
                    show: openModal,
                })}
        </>
    );
}

AttachmentModal.displayName = 'AttachmentModal';

export default withOnyx<AttachmentModalProps, AttachmentModalOnyxProps>({
    transaction: {
        key: ({report}) => {
            const parentReportAction = ReportActionsUtils.getReportAction(report?.parentReportID ?? '', report?.parentReportActionID ?? '');
            const transactionID = parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.IOU ? parentReportAction?.originalMessage.IOUTransactionID ?? '' : '';
            return `${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`;
        },
    },
    parentReport: {
        key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT}${report ? report.parentReportID : '0'}`,
    },
    policy: {
        key: ({report}) => `${ONYXKEYS.COLLECTION.POLICY}${report ? report.policyID : '0'}`,
    },
    parentReportActions: {
        key: ({report}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report ? report.parentReportID : '0'}`,
        canEvict: false,
    },
    session: {
        key: ONYXKEYS.SESSION,
    },
})(AttachmentModal);
