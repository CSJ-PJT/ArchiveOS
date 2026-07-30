resource "oci_core_volume" "archiveos" {
  availability_domain = oci_core_instance.archiveos.availability_domain
  compartment_id      = var.compartment_ocid
  display_name        = "archiveos-canary-data"
  size_in_gbs         = var.data_volume_gb
  vpus_per_gb         = var.data_volume_vpus_per_gb
  freeform_tags       = var.freeform_tags
}

resource "oci_core_volume_attachment" "archiveos" {
  attachment_type = "paravirtualized"
  instance_id     = oci_core_instance.archiveos.id
  volume_id       = oci_core_volume.archiveos.id
  display_name    = "archiveos-canary-data-attachment"
}

resource "oci_objectstorage_bucket" "backups" {
  compartment_id = var.compartment_ocid
  name           = var.backup_bucket_name
  namespace      = data.oci_objectstorage_namespace.current.namespace
  access_type    = "NoPublicAccess"
  storage_tier   = "Standard"
  versioning     = "Enabled"
  freeform_tags  = var.freeform_tags
}

data "oci_objectstorage_namespace" "current" {
  compartment_id = var.compartment_ocid
}
