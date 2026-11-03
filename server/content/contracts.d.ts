export type Id = string
export interface GalleryItem {
  id: Id; position: number; alt: string; caption: string | null;
  credit: string | null; cover: boolean;
}
export interface ProjectDraft {
  id: string; slug: string; title: string; description: string; category: string;
  location: string | null; mission: string; agency: string | null;
  context: string | null; images: GalleryItem[];
}
export interface PublishedProject extends Omit<ProjectDraft, 'images'> {
  images: (GalleryItem & {kind: 'image'; width: number; height: number})[];
}
export interface PublishedContent {
  schemaVersion: 1; releaseId: Id; version: number;
  projects: PublishedProject[]; featured: string[];
  profile: {
    name: string; profession: string; location: string; presentation: string;
    signatureHome: string; signatureAbout: string; email: string; phone: string;
    whatsapp: string; heroMediaId: Id; portraitMediaId: Id; pdfMediaId: Id;
    socials: {label: string; url: string}[];
  };
  services: {title: string; description: string; mediaId: Id | null; alt: string | null; credit: string | null}[];
}
export interface PublishCommand {
  revisionIds: Id[]; siteRevisionId: Id; featuredProjectIds: Id[]; expectedVersion: number;
}
export interface AdminRevision {
  revisionId: Id; projectId: Id; editable: boolean; data: ProjectDraft;
  // Private source facts; MUST NOT be spread into PublishedContent.
  internal: Record<string, unknown>;
}
export interface ContentRepository {
  readPublished(): Promise<PublishedContent | null>;
  previewProject(revisionId: Id): Promise<PublishedProject | null>;
  publish(command: PublishCommand): Promise<Id>;
  restore(releaseId: Id, expectedVersion: number): Promise<null>;
}
// Application HTTP contracts; no internal archive or session token reaches React.
export interface AdminProjectSummary {
  id: Id; slug: string; legacyId: string | null; revisionId: Id;
  publishedRevisionId: Id | null; status: 'draft' | 'published' | 'changed';
  data: PublishedProject;
}
export interface AdminProjectSnapshot {
  version: number; siteId: Id | null; projects: AdminProjectSummary[];
}
export interface SaveProjectCommand {
  projectId: Id | null; expectedRevision: Id | null; data: Omit<ProjectDraft, 'id'>;
}
export interface PublishProjectCommand {
  projectId: Id; revisionId: Id; siteId: Id; expectedVersion: number;
}
export interface ImageImportAuthorization {
  id: Id;
  // Private, path-limited upload capability; never log or persist this URL.
  uploadUrl: string;
}
export interface AdminImage {
  id: Id; name: string; width: number; height: number; deleting: boolean;
  defaults: Partial<Pick<GalleryItem, 'alt' | 'caption' | 'credit'>>;
  dependencies: { versions: { title: string; revisionId: Id; published: boolean }[]; siteReferences: number; derivatives: number };
}
export interface SiteService { title: string; description: string; mediaId: Id | null; alt: string | null; credit: string | null }
export interface SiteDraft {
  name: string; profession: string; location: string; headline: string; subtitle: string;
  presentation: string; approach: string; signatureAbout: string; email: string; phone: string;
  heroMediaId: Id; heroAlt: string; heroCredit: string | null;
  portraitMediaId: Id; portraitAlt: string; portraitCredit: string | null;
  pdfMediaId: Id; pdfDownloadName: string; services: SiteService[];
  socials: { label: string; url: string }[];
}
export interface SitePreview extends SiteDraft {
  whatsapp: string;
  pdf: { id: Id; bytes: number; pages: number | null; downloadName: string };
  contactLinks?: { email: string; quote: string; whatsapp: string };
}
export interface SiteSnapshot {
  revisionId: Id; publishedRevisionId: Id | null; version: number; data: SitePreview;
  history: { revisionId: Id; name: string; createdAt: string; active: boolean }[];
}
export interface PDFImportAuthorization {
  id: Id; objectKey: string; endpoint: string; bucket: string; publishableKey: string;
  // Short-lived single-object capability, not a user JWT. Never persist/log.
  signature: string;
}
export interface PDFPrivateLinks { previewUrl: string; downloadUrl: string; expiresIn: number; bytes: number; pages: number | null }
