data "oci_identity_availability_domains" "available" {
  compartment_id = var.tenancy_ocid
}

resource "oci_core_instance" "archiveos" {
  availability_domain  = data.oci_identity_availability_domains.available.availability_domains[0].name
  compartment_id       = var.compartment_ocid
  display_name         = "archiveos-canary"
  shape                = var.compute_shape
  preserve_boot_volume = true

  shape_config {
    ocpus         = var.compute_ocpus
    memory_in_gbs = var.compute_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = var.compute_image_id
    boot_volume_size_in_gbs = var.boot_volume_gb
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.private.id
    assign_public_ip = false
    hostname_label   = "archiveos-canary"
    nsg_ids          = [oci_core_network_security_group.compute.id]
  }

  metadata = {
    ssh_authorized_keys = var.ssh_authorized_keys
    user_data = base64encode(<<-CLOUD_INIT
      #cloud-config
      package_update: true
      packages:
        - jq
        - xfsprogs
      runcmd:
        - [mkdir, -p, /opt/archiveos, /srv/archiveos]
        - [chmod, "0750", /opt/archiveos]
      final_message: "ArchiveOS canary host bootstrap complete; deployment remains operator-gated."
    CLOUD_INIT
    )
  }

  freeform_tags = var.freeform_tags
}

data "oci_core_vnic_attachments" "archiveos" {
  compartment_id = var.compartment_ocid
  instance_id    = oci_core_instance.archiveos.id
}

data "oci_core_vnic" "archiveos" {
  vnic_id = data.oci_core_vnic_attachments.archiveos.vnic_attachments[0].vnic_id
}
