-- Stable indexed ordering for the Link Management paginated list.
create index if not exists mfp_documents_link_management_page_idx
  on public.mfp_documents (collection_name, created_at desc, document_id desc)
  where collection_name in ('profiles','posts');
