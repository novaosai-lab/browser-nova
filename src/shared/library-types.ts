export interface Bookmark { id: string; title: string; url: string; }
export interface SavedLogin { id: string; origin: string; username: string; }
export interface LibraryState { bookmarks: Bookmark[]; logins: SavedLogin[]; encryptionAvailable: boolean; }
