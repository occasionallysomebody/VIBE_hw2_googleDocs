// Shared data model between client and server
// Following Canva's architecture: separate concerns, strong typing, efficient serialization

export enum ElementType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  MOODBOARD = 'moodboard',
  TEMPLATE = 'template'
}

export enum PermissionLevel {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  COMMENTER = 'commenter'
}

export interface User {
  id: string;
  name: string;
  color: string; // For cursor/selection highlighting
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Transform {
  position: Position;
  size: Size;
  rotation: number;
  zIndex: number;
}

// Base element interface
export interface BaseElement {
  id: string;
  type: ElementType;
  transform: Transform;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  createdBy: string;
  modifiedAt: number;
  modifiedBy: string;
}

export interface TextElement extends BaseElement {
  type: ElementType.TEXT;
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
}

export interface ImageElement extends BaseElement {
  type: ElementType.IMAGE;
  src: string; // URL or base64
  alt: string;
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
  };
}

export interface VideoElement extends BaseElement {
  type: ElementType.VIDEO;
  src: string;
  thumbnail: string;
  duration: number;
  startTime: number; // Trim start
  endTime: number; // Trim end
}

export interface MoodboardElement extends BaseElement {
  type: ElementType.MOODBOARD;
  items: Array<{
    id: string;
    src: string;
    position: Position;
    size: Size;
  }>;
  backgroundColor: string;
}

export interface TemplateElement extends BaseElement {
  type: ElementType.TEMPLATE;
  templateId: string;
  slots: Record<string, any>; // Template variable slots
}

export type DocumentElement = 
  | TextElement 
  | ImageElement 
  | VideoElement 
  | MoodboardElement 
  | TemplateElement;

export interface DocumentVersion {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  description: string;
  snapshot: DocumentState;
}

export interface DocumentState {
  elements: Map<string, DocumentElement>;
  width: number;
  height: number;
  backgroundColor: string;
}

export interface Document {
  id: string;
  title: string;
  state: DocumentState;
  permissions: Map<string, PermissionLevel>;
  versions: DocumentVersion[];
  createdAt: number;
  modifiedAt: number;
}

// Operation-based CRDT for conflict-free synchronization
export enum OperationType {
  CREATE_ELEMENT = 'create_element',
  UPDATE_ELEMENT = 'update_element',
  DELETE_ELEMENT = 'delete_element',
  MOVE_ELEMENT = 'move_element',
  RESIZE_ELEMENT = 'resize_element',
  UPDATE_TEXT = 'update_text',
  UPDATE_PERMISSIONS = 'update_permissions',
  CREATE_VERSION = 'create_version'
}

export interface BaseOperation {
  id: string; // Unique operation ID
  type: OperationType;
  documentId: string;
  userId: string;
  timestamp: number;
  version: number; // For ordering operations
}

export interface CreateElementOp extends BaseOperation {
  type: OperationType.CREATE_ELEMENT;
  element: DocumentElement;
}

export interface UpdateElementOp extends BaseOperation {
  type: OperationType.UPDATE_ELEMENT;
  elementId: string;
  changes: Partial<DocumentElement>;
}

export interface DeleteElementOp extends BaseOperation {
  type: OperationType.DELETE_ELEMENT;
  elementId: string;
}

export interface MoveElementOp extends BaseOperation {
  type: OperationType.MOVE_ELEMENT;
  elementId: string;
  position: Position;
}

export interface ResizeElementOp extends BaseOperation {
  type: OperationType.RESIZE_ELEMENT;
  elementId: string;
  size: Size;
}

export interface UpdateTextOp extends BaseOperation {
  type: OperationType.UPDATE_TEXT;
  elementId: string;
  content: string;
}

export interface UpdatePermissionsOp extends BaseOperation {
  type: OperationType.UPDATE_PERMISSIONS;
  targetUserId: string;
  permission: PermissionLevel;
}

export interface CreateVersionOp extends BaseOperation {
  type: OperationType.CREATE_VERSION;
  description: string;
}

export type Operation = 
  | CreateElementOp 
  | UpdateElementOp 
  | DeleteElementOp 
  | MoveElementOp 
  | ResizeElementOp 
  | UpdateTextOp
  | UpdatePermissionsOp
  | CreateVersionOp;

// WebSocket message types
export enum MessageType {
  // Connection lifecycle
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  
  // Document operations
  JOIN_DOCUMENT = 'join_document',
  LEAVE_DOCUMENT = 'leave_document',
  DOCUMENT_STATE = 'document_state',
  
  // Real-time operations
  OPERATION = 'operation',
  OPERATION_ACK = 'operation_ack',
  BATCH_OPERATIONS = 'batch_operations',
  
  // Presence
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  CURSOR_UPDATE = 'cursor_update',
  SELECTION_UPDATE = 'selection_update',
  
  // Version control
  GET_VERSIONS = 'get_versions',
  VERSIONS_LIST = 'versions_list',
  RESTORE_VERSION = 'restore_version',
  
  // Error handling
  ERROR = 'error'
}

export interface BaseMessage {
  type: MessageType;
  timestamp: number;
}

export interface ConnectMessage extends BaseMessage {
  type: MessageType.CONNECT;
  user: User;
  token?: string; // Optional auth token
}

export interface JoinDocumentMessage extends BaseMessage {
  type: MessageType.JOIN_DOCUMENT;
  documentId: string;
}

export interface DocumentStateMessage extends BaseMessage {
  type: MessageType.DOCUMENT_STATE;
  document: Document;
  activeUsers: User[];
}

export interface OperationMessage extends BaseMessage {
  type: MessageType.OPERATION;
  operation: Operation;
}

export interface BatchOperationsMessage extends BaseMessage {
  type: MessageType.BATCH_OPERATIONS;
  operations: Operation[];
}

export interface CursorUpdateMessage extends BaseMessage {
  type: MessageType.CURSOR_UPDATE;
  userId: string;
  position: Position | null; // null = cursor left canvas
}

export interface SelectionUpdateMessage extends BaseMessage {
  type: MessageType.SELECTION_UPDATE;
  userId: string;
  elementIds: string[];
}

export interface UserJoinedMessage extends BaseMessage {
  type: MessageType.USER_JOINED;
  user: User;
}

export interface UserLeftMessage extends BaseMessage {
  type: MessageType.USER_LEFT;
  userId: string;
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  code: string;
  message: string;
}

export type Message = 
  | ConnectMessage 
  | JoinDocumentMessage 
  | DocumentStateMessage 
  | OperationMessage 
  | BatchOperationsMessage
  | CursorUpdateMessage
  | SelectionUpdateMessage
  | UserJoinedMessage
  | UserLeftMessage
  | ErrorMessage;

// Template system (Canva-style drag-drop templates)
export interface Template {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  elements: DocumentElement[];
  defaultWidth: number;
  defaultHeight: number;
  tags: string[];
}

// Pre-loaded asset manifest for instant rendering
export interface AssetManifest {
  templates: Template[];
  fonts: Array<{ family: string; url: string; }>;
  images: Record<string, string>; // id -> url mapping
  videos: Record<string, string>;
}
