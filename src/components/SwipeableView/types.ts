import {ReactNode} from 'react';

type SwipeableViewProps = {
    /** The content to be rendered within the SwipeableView */
    children: ReactNode;

    /** Callback to fire when the user swipes down on the child content */
    onSwipeDown: () => void;
};

type SwipeableViewComponent = React.FC<SwipeableViewProps>;

export default SwipeableViewComponent;

export type {SwipeableViewProps};
