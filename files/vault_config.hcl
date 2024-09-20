storage "raft" {
        path = "/opt/vault/data"
        node_id = "node_1"
}
listener "tcp" {
        address = "0.0.0.0:8200"
        cluster_address = "0.0.0.0:8201"
        tls_disable = 1
}
seal "awskms" {
        region     = "ap-southeast-2"
        kms_key_id = "KMS_ID"
}
cluster_addr = "http://127.0.0.1:8201"
api_addr = "http://127.0.0.1:8200"
disable_mlock = true
ui = true
