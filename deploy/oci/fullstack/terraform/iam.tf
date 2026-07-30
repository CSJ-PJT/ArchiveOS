resource "oci_identity_dynamic_group" "archiveos" {
  compartment_id = var.tenancy_ocid
  name           = "archiveos-canary-instances"
  description    = "ArchiveOS canary Compute instance principal."
  matching_rule  = "ALL {instance.id = '${oci_core_instance.archiveos.id}'}"
  freeform_tags  = var.freeform_tags
}

resource "oci_identity_policy" "archiveos" {
  compartment_id = var.tenancy_ocid
  name           = "archiveos-canary-instance-policy"
  description    = "Least-privilege reads and backup writes for ArchiveOS canary."

  statements = [
    "Allow dynamic-group ${oci_identity_dynamic_group.archiveos.name} to read secret-bundles in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group ${oci_identity_dynamic_group.archiveos.name} to read repos in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group ${oci_identity_dynamic_group.archiveos.name} to manage objects in compartment id ${var.compartment_ocid} where target.bucket.name='${oci_objectstorage_bucket.backups.name}'",
    "Allow dynamic-group ${oci_identity_dynamic_group.archiveos.name} to read buckets in compartment id ${var.compartment_ocid}"
  ]
}
