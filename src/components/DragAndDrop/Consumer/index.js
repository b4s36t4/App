import React, {useContext, useEffect, useRef} from 'react';
import {Portal} from '@gorhom/portal';
import dragAndDropConsumerPropTypes from './dragAndDropConsumerPropTypes';
import DNDUtils from '../Utils';

function DragAndDropConsumer({children, dropZoneID, dropZoneHostName, onDrop}) {
    const DragAndDropContext = DNDUtils.getDragAndDropContext(dropZoneID);
    const {isDraggingOver} = useContext(DragAndDropContext);

    const onDropRef = useRef(onDrop);
    onDropRef.current = onDrop;
    useEffect(() => {
        // Internal function ensures that we only register the onDrop listener once for this consumer,
        // even if the onDrop function passed in changes
        const onDropCallback = () => {
            if (!onDropRef.current) {
                return;
            }
            onDropRef.current();
        };
        DNDUtils.registerOnDropCallback(dropZoneID, onDropCallback);
        return () => DNDUtils.deregisterOnDropCallback(dropZoneID, onDropCallback);
    }, [dropZoneID]);

    if (!isDraggingOver) {
        return null;
    }

    return <Portal hostName={dropZoneHostName}>{children}</Portal>;
}

DragAndDropConsumer.propTypes = dragAndDropConsumerPropTypes;
DragAndDropConsumer.displayName = 'DragAndDropConsumer';

export default DragAndDropConsumer;
