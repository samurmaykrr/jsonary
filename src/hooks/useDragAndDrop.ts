import { useState, useCallback, useRef, type DragEvent } from 'react';

export interface DragAndDropState<T> {
  isDragging: boolean;
  draggedItem: T | null;
  draggedIndex: number | null;
  dropTargetIndex: number | null;
}

export interface UseDragAndDropOptions<T> {
  items: T[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  getItemId: (item: T) => string;
}

export interface UseDragAndDropReturn<T> {
  state: DragAndDropState<T>;
  handleDragStart: (e: DragEvent<HTMLElement>, item: T, index: number) => void;
  handleDragOver: (e: DragEvent<HTMLElement>, index: number) => void;
  handleDragEnd: () => void;
  handleDrop: (e: DragEvent<HTMLElement>, index: number) => void;
  getDragProps: (item: T, index: number) => {
    draggable: true;
    onDragStart: (e: DragEvent<HTMLElement>) => void;
    onDragOver: (e: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
    onDrop: (e: DragEvent<HTMLElement>) => void;
    onDragLeave: () => void;
    'data-dragging': boolean;
    'data-drop-target': boolean;
  };
}

export function useDragAndDrop<T>({
  onReorder,
  getItemId,
}: UseDragAndDropOptions<T>): UseDragAndDropReturn<T> {
  const [state, setState] = useState<DragAndDropState<T>>({
    isDragging: false,
    draggedItem: null,
    draggedIndex: null,
    dropTargetIndex: null,
  });

  const dragCounterRef = useRef(0);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLElement>, item: T, index: number) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', getItemId(item));
      
      // Set a custom drag image (optional)
      const target = e.currentTarget;
      if (target) {
        e.dataTransfer.setDragImage(target, 0, 0);
      }

      setState({
        isDragging: true,
        draggedItem: item,
        draggedIndex: index,
        dropTargetIndex: null,
      });
    },
    [getItemId]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      setState((prev) => ({
        ...prev,
        dropTargetIndex: index,
      }));
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setState((prev) => ({
        ...prev,
        dropTargetIndex: null,
      }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>, dropIndex: number) => {
      e.preventDefault();
      
      const { draggedIndex } = state;
      
      if (draggedIndex !== null && draggedIndex !== dropIndex) {
        onReorder(draggedIndex, dropIndex);
      }

      setState({
        isDragging: false,
        draggedItem: null,
        draggedIndex: null,
        dropTargetIndex: null,
      });
      dragCounterRef.current = 0;
    },
    [state.draggedIndex, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setState({
      isDragging: false,
      draggedItem: null,
      draggedIndex: null,
      dropTargetIndex: null,
    });
    dragCounterRef.current = 0;
  }, []);

  const getDragProps = useCallback(
    (item: T, index: number) => ({
      draggable: true as const,
      onDragStart: (e: DragEvent<HTMLElement>) => handleDragStart(e, item, index),
      onDragOver: (e: DragEvent<HTMLElement>) => handleDragOver(e, index),
      onDragEnd: handleDragEnd,
      onDrop: (e: DragEvent<HTMLElement>) => handleDrop(e, index),
      onDragLeave: handleDragLeave,
      'data-dragging': state.draggedIndex === index,
      'data-drop-target': state.dropTargetIndex === index && state.draggedIndex !== index,
    }),
    [handleDragStart, handleDragOver, handleDragEnd, handleDrop, handleDragLeave, state.draggedIndex, state.dropTargetIndex]
  );

  return {
    state,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
    getDragProps,
  };
}
