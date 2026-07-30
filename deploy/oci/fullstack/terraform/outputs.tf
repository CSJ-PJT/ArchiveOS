output "compute_instance_id" {
  value     = oci_core_instance.archiveos.id
  sensitive = true
}

output "compute_private_ip" {
  value = data.oci_core_vnic.archiveos.private_ip_address
}

output "private_subnet_id" {
  value     = oci_core_subnet.private.id
  sensitive = true
}

output "block_volume_id" {
  value     = oci_core_volume.archiveos.id
  sensitive = true
}

output "load_balancer_ip" {
  value = oci_load_balancer_load_balancer.archiveos.ip_address_details[0].ip_address
}

output "backup_bucket_name" {
  value = oci_objectstorage_bucket.backups.name
}

output "canary_hostname" {
  value = var.canary_hostname
}
