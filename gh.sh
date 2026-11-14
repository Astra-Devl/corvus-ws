#!/usr/bin/env bash

# ==============================================================================
# GitHub API Manager & Auto Uploader (Pure cURL + Bash)
# Fitur: Set Token, List Repo (Public/Private), Create Repo, Auto Upload, Create File
# ==============================================================================

CONFIG_FILE="$HOME/.gh_api_uploader.conf"
API_URL="https://api.github.com"

# Daftar folder & file bawaan yang otomatis dilewati saat upload folder
DEFAULT_EXCLUDES=(
    ".git"
    "node_modules"
    ".npm"
    ".cache"
    ".yarn"
    ".pnpm-store"
    "vendor"
    "__pycache__"
    ".venv"
    "venv"
    ".next"
    ".nuxt"
    "dist"
    "build"
    ".env"
    ".env.*"
    ".DS_Store"
    "*.log"
)

# Warna Terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
    fi
}

check_token() {
    load_config
    if [[ -z "$GITHUB_TOKEN" || -z "$GITHUB_USER" ]]; then
        echo -e "${RED}[!] Token GitHub belum diatur atau tidak valid.${NC}"
        echo -e "${YELLOW}Silakan pilih menu 1 (Set Token GitHub) terlebih dahulu.${NC}"
        return 1
    fi
    return 0
}

json_escape() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

# ==============================================================================
# FUNGSI DETEKSI & TAMPILKAN DAFTAR REPOSITORY (PUBLIC & PRIVATE)
# ==============================================================================
fetch_and_display_repos() {
    REPO_LIST_FULL=()
    REPO_LIST_PRIV=()

    echo -e "${YELLOW}[*] Mengambil daftar repository (Public & Private) dari GitHub...${NC}"
    local response http_code body
    response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/user/repos?visibility=all&sort=updated&per_page=100" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" ]]; then
        echo -e "${RED}[✗] Gagal mengambil daftar repository (HTTP $http_code).${NC}"
        return 1
    fi

    # Parser JSON murni (awk) berdasarkan kedalaman kurung kurawal agar akurat tanpa jq
    local parsed
    parsed=$(printf '%s\n' "$body" | awk '
    BEGIN { depth = 0; full = ""; priv = "" }
    {
        if (depth == 1) {
            if ($0 ~ /^[[:space:]]*"full_name"[[:space:]]*:/) {
                val = $0
                sub(/.*"full_name"[[:space:]]*:[[:space:]]*"/, "", val)
                sub(/".*/, "", val)
                full = val
            }
            if ($0 ~ /^[[:space:]]*"private"[[:space:]]*:/) {
                val = $0
                sub(/.*"private"[[:space:]]*:[[:space:]]*/, "", val)
                sub(/[^a-z].*/, "", val)
                priv = val
            }
        }
        line = $0
        gsub(/\\./, "", line)
        gsub(/"[^"]*"/, "", line)
        for (i = 1; i <= length(line); i++) {
            c = substr(line, i, 1)
            if (c == "{") depth++
            else if (c == "}") {
                if (depth == 1 && full != "") {
                    print full "|" priv
                    full = ""; priv = ""
                }
                depth--
            }
        }
    }')

    if [[ -z "$parsed" ]]; then
        echo -e "${YELLOW}[!] Tidak ada repository ditemukan pada akun ini.${NC}"
        return 0
    fi

    local idx=1
    echo -e "\n${CYAN}Daftar Repository Terdeteksi (Terbaru):${NC}"
    echo -e "------------------------------------------------------------"
    while IFS='|' read -r r_full r_priv; do
        [[ -z "$r_full" ]] && continue
        REPO_LIST_FULL+=("$r_full")
        REPO_LIST_PRIV+=("$r_priv")

        if [[ "$r_priv" == "true" ]]; then
            printf "  %2d) %-38s ${MAGENTA}[PRIVATE]${NC}\n" "$idx" "$r_full"
        else
            printf "  %2d) %-38s ${GREEN}[PUBLIC]${NC}\n" "$idx" "$r_full"
        fi
        ((idx++))
    done <<< "$parsed"
    echo -e "------------------------------------------------------------"
    return 0
}

# Pemilih interaktif repository (pilih nomor dari list atau ketik manual)
select_target_repository() {
    SELECTED_REPO=""
    fetch_and_display_repos || return 1

    local count=${#REPO_LIST_FULL[@]}
    if [[ "$count" -gt 0 ]]; then
        read -rp "Pilih nomor repo [1-$count] atau ketik nama repo manual: " repo_input
    else
        read -rp "Masukkan nama repository tujuan: " repo_input
    fi

    if [[ -z "$repo_input" ]]; then
        echo -e "${RED}[!] Repository tujuan tidak boleh kosong.${NC}"
        return 1
    fi

    # Jika input berupa angka valid sesuai nomor list
    if [[ "$repo_input" =~ ^[0-9]+$ ]] && (( repo_input >= 1 && repo_input <= count )); then
        SELECTED_REPO="${REPO_LIST_FULL[$((repo_input - 1))]}"
    else
        # Jika mengetik manual tanpa prefix username, tambahkan otomatis
        if [[ "$repo_input" == *"/"* ]]; then
            SELECTED_REPO="$repo_input"
        else
            SELECTED_REPO="$GITHUB_USER/$repo_input"
        fi
    fi

    echo -e "Target Repository: ${CYAN}$SELECTED_REPO${NC}"
    return 0
}

# ==============================================================================
# MENU 1: SET & VALIDASI TOKEN GITHUB
# ==============================================================================
set_github_token() {
    echo -e "\n${CYAN}=== SET TOKEN GITHUB ===${NC}"
    echo -e "Pastikan token memiliki izin ${YELLOW}repo${NC} (Classic) agar repository ${MAGENTA}Private${NC} ikut terdeteksi."
    read -rsp "Masukkan GitHub Personal Access Token (input tersembunyi): " input_token
    echo ""

    if [[ -z "$input_token" ]]; then
        echo -e "${RED}[!] Token tidak boleh kosong.${NC}"
        return
    fi

    echo -e "${YELLOW}[*] Memverifikasi token ke GitHub API...${NC}"
    response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/user" \
        -H "Authorization: Bearer $input_token" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" == "200" ]]; then
        gh_user=$(echo "$body" | grep -o '"login": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
        cat > "$CONFIG_FILE" <<EOF
GITHUB_TOKEN="$input_token"
GITHUB_USER="$gh_user"
EOF
        chmod 600 "$CONFIG_FILE"
        GITHUB_TOKEN="$input_token"
        GITHUB_USER="$gh_user"
        echo -e "${GREEN}[✓] Berhasil terhubung sebagai akun GitHub: ${CYAN}$GITHUB_USER${NC}"
        echo -e "${GREEN}[✓] Konfigurasi disimpan aman di $CONFIG_FILE${NC}"
    else
        echo -e "${RED}[✗] Gagal memverifikasi token (HTTP $http_code). Periksa kembali token Anda.${NC}"
    fi
}

# ==============================================================================
# MENU 2: LIHAT LIST REPOSITORY (PUBLIC & PRIVATE)
# ==============================================================================
list_repositories_menu() {
    check_token || return
    echo -e "\n${CYAN}=== LIST REPOSITORY GITHUB ===${NC}"
    fetch_and_display_repos

    local total=${#REPO_LIST_FULL[@]}
    local priv_count=0
    local pub_count=0

    for p in "${REPO_LIST_PRIV[@]}"; do
        if [[ "$p" == "true" ]]; then
            ((priv_count++))
        else
            ((pub_count++))
        fi
    done

    echo -e "Total: ${CYAN}$total${NC} repo (${GREEN}$pub_count Public${NC}, ${MAGENTA}$priv_count Private${NC})"
}

# ==============================================================================
# MENU 3: CREATE REPOSITORY (PUBLIC / PRIVATE)
# ==============================================================================
create_repository() {
    check_token || return 1

    echo -e "\n${CYAN}=== BUAT REPOSITORY BARU ===${NC}"
    read -rp "Nama Repository Baru: " repo_name
    if [[ -z "$repo_name" ]]; then
        echo -e "${RED}[!] Nama repository tidak boleh kosong.${NC}"
        return 1
    fi

    read -rp "Deskripsi Repository (opsional): " repo_desc
    echo "Pilih visibilitas repository:"
    echo "  1) Public"
    echo "  2) Private"
    read -rp "Pilihan [1/2]: " vis_choice

    if [[ "$vis_choice" == "2" ]]; then
        is_private="true"
        vis_label="Private"
    else
        is_private="false"
        vis_label="Public"
    fi

    esc_name=$(json_escape "$repo_name")
    esc_desc=$(json_escape "$repo_desc")

    payload="{\"name\":\"$esc_name\",\"description\":\"$esc_desc\",\"private\":$is_private,\"auto_init\":false}"

    echo -e "${YELLOW}[*] Membuat repository '$repo_name' ($vis_label)...${NC}"
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/user/repos" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        -d "$payload")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" == "201" ]]; then
        CREATED_REPO_FULL="$GITHUB_USER/$repo_name"
        echo -e "${GREEN}[✓] Repository '$CREATED_REPO_FULL' ($vis_label) berhasil dibuat!${NC}"
        return 0
    else
        err_msg=$(echo "$body" | grep -o '"message": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
        echo -e "${RED}[✗] Gagal membuat repository (HTTP $http_code): $err_msg${NC}"
        return 1
    fi
}

# ==============================================================================
# FUNGSI INTI: PUSH SATU FILE (BASE64) KE GITHUB CONTENTS API
# ==============================================================================
push_single_file_api() {
    local full_repo="$1"
    local local_file="$2"
    local remote_path="$3"
    local commit_msg="$4"

    local encoded_path
    encoded_path=$(printf '%s' "$remote_path" | sed 's/ /%20/g')

    # Cek apakah file sudah ada di repo untuk mengambil SHA (agar bisa overwrite/update)
    local check_resp check_code check_body existing_sha
    check_resp=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/repos/$full_repo/contents/$encoded_path" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28")

    check_code=$(echo "$check_resp" | tail -n1)
    check_body=$(echo "$check_resp" | sed '$d')

    existing_sha=""
    if [[ "$check_code" == "200" ]]; then
        existing_sha=$(echo "$check_body" | grep -o '"sha": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
    fi

    local esc_msg
    esc_msg=$(json_escape "$commit_msg")

    local put_resp put_code put_body
    put_resp=$( {
        printf '{"message":"%s",' "$esc_msg"
        if [[ -n "$existing_sha" ]]; then
            printf '"sha":"%s",' "$existing_sha"
        fi
        printf '"content":"'
        base64 "$local_file" | tr -d '\n'
        printf '"}'
    } | curl -s -w "\n%{http_code}" -X PUT "$API_URL/repos/$full_repo/contents/$encoded_path" \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        --data-binary @- )

    put_code=$(echo "$put_resp" | tail -n1)
    put_body=$(echo "$put_resp" | sed '$d')

    if [[ "$put_code" == "201" || "$put_code" == "200" ]]; then
        echo -e "  ${GREEN}[OK]${NC} $remote_path"
        return 0
    else
        local err_msg
        err_msg=$(echo "$put_body" | grep -o '"message": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
        echo -e "  ${RED}[GAGAL]${NC} $remote_path (HTTP $put_code: $err_msg)"
        return 1
    fi
}

# ==============================================================================
# MENU 4: UPLOAD FILE ATAU FOLDER OTOMATIS KE GITHUB
# ==============================================================================
upload_to_github() {
    check_token || return

    echo -e "\n${CYAN}=== UPLOAD FILE / FOLDER KE GITHUB ===${NC}"
    read -rp "Apakah ingin membuat repository baru terlebih dahulu? [y/n]: " create_choice

    target_repo=""
    if [[ "$create_choice" =~ ^[Yy]$ ]]; then
        CREATED_REPO_FULL=""
        create_repository
        if [[ $? -ne 0 || -z "$CREATED_REPO_FULL" ]]; then
            echo -e "${RED}[!] Proses upload dibatalkan karena pembuatan repository gagal.${NC}"
            return
        fi
        target_repo="$CREATED_REPO_FULL"
    else
        select_target_repository || return
        target_repo="$SELECTED_REPO"
    fi

    read -rp "Masukkan path lengkap File atau Folder di VPS (misal: /var/www/project): " source_path
    source_path="${source_path%/}"

    if [[ ! -e "$source_path" ]]; then
        echo -e "${RED}[!] Path '$source_path' tidak ditemukan di VPS.${NC}"
        return
    fi

    read -rp "Folder tujuan di dalam repo (kosongkan untuk root '/'): " remote_prefix
    remote_prefix="${remote_prefix#/}"
    remote_prefix="${remote_prefix%/}"

    read -rp "Pesan Commit [default: Upload via Bash API]: " commit_msg
    commit_msg="${commit_msg:-Upload via Bash API}"

    if [[ -f "$source_path" ]]; then
        echo -e "\n${YELLOW}[*] Memulai proses upload file ke $target_repo ...${NC}"
        filename=$(basename "$source_path")
        if [[ -n "$remote_prefix" ]]; then
            dest_path="$remote_prefix/$filename"
        else
            dest_path="$filename"
        fi
        push_single_file_api "$target_repo" "$source_path" "$dest_path" "$commit_msg"

    elif [[ -d "$source_path" ]]; then
        echo -e "\n${CYAN}Filter Pengecualian Folder/File:${NC}"
        echo -e "Bawaan: ${YELLOW}${DEFAULT_EXCLUDES[*]}${NC}"
        echo "  1) Gunakan filter bawaan (Direkomendasikan)"
        echo "  2) Gunakan filter bawaan + tambah pengecualian lain"
        echo "  3) Upload semua (hanya lewati .git)"
        read -rp "Pilihan filter [1/2/3, default 1]: " filter_choice

        active_excludes=()
        case "$filter_choice" in
            2)
                active_excludes=("${DEFAULT_EXCLUDES[@]}")
                read -rp "Masukkan nama folder/file tambahan (pisahkan spasi, misal: tmp *.zip): " extra_input
                if [[ -n "$extra_input" ]]; then
                    read -ra extra_arr <<< "$extra_input"
                    active_excludes+=("${extra_arr[@]}")
                fi
                ;;
            3)
                active_excludes=(".git")
                ;;
            *)
                active_excludes=("${DEFAULT_EXCLUDES[@]}")
                ;;
        esac

        prune_expr=()
        for item in "${active_excludes[@]}"; do
            if [[ ${#prune_expr[@]} -gt 0 ]]; then
                prune_expr+=(-o)
            fi
            prune_expr+=(-name "$item")
        done

        mapfile -t rel_files < <(
            cd "$source_path" && \
            find . \( "${prune_expr[@]}" \) -prune -o -type f -print | sed 's|^\./||'
        )

        total_files=${#rel_files[@]}
        if [[ "$total_files" -eq 0 ]]; then
            echo -e "${YELLOW}[!] Tidak ada file yang tersisa setelah difilter.${NC}"
            return
        fi

        echo -e "\n${YELLOW}[*] Memulai upload ke $target_repo ...${NC}"
        echo -e "Ditemukan ${CYAN}$total_files${NC} file valid. Mengunggah otomatis...\n"
        success_count=0
        fail_count=0

        for idx in "${!rel_files[@]}"; do
            rel_path="${rel_files[$idx]}"
            full_local_file="$source_path/$rel_path"

            if [[ -n "$remote_prefix" ]]; then
                dest_path="$remote_prefix/$rel_path"
            else
                dest_path="$rel_path"
            fi

            printf "[%d/%d] " "$((idx + 1))" "$total_files"
            if push_single_file_api "$target_repo" "$full_local_file" "$dest_path" "$commit_msg"; then
                ((success_count++))
            else
                ((fail_count++))
            fi
        done

        echo -e "\n${CYAN}=== RINGKASAN UPLOAD ===${NC}"
        echo -e "Berhasil : ${GREEN}$success_count${NC}"
        echo -e "Gagal    : ${RED}$fail_count${NC}"
        echo -e "URL Repo : ${CYAN}https://github.com/$target_repo${NC}"
    fi
}

# ==============================================================================
# MENU 5: CREATE FILE BARU LANGSUNG DI GITHUB
# ==============================================================================
create_file_on_github() {
    check_token || return

    echo -e "\n${CYAN}=== CREATE FILE LANGSUNG DI GITHUB ===${NC}"
    select_target_repository || return
    local target_repo="$SELECTED_REPO"

    read -rp "Nama/Path file di GitHub (misal: README.md atau config/app.env): " remote_path
    remote_path="${remote_path#/}"
    if [[ -z "$remote_path" ]]; then
        echo -e "${RED}[!] Path file tidak boleh kosong.${NC}"
        return
    fi

    read -rp "Pesan Commit [default: Create $remote_path]: " commit_msg
    commit_msg="${commit_msg:-Create $remote_path}"

    echo -e "${YELLOW}Ketik isi file di bawah ini. Ketik 'EOF' pada baris baru lalu tekan Enter jika selesai:${NC}"
    file_content=""
    while IFS= read -r line; do
        [[ "$line" == "EOF" ]] && break
        file_content+="$line"$'\n'
    done

    tmp_file=$(mktemp)
    printf '%s' "$file_content" > "$tmp_file"

    echo -e "${YELLOW}[*] Membuat file '$remote_path' di $target_repo...${NC}"
    push_single_file_api "$target_repo" "$tmp_file" "$remote_path" "$commit_msg"
    rm -f "$tmp_file"
}

# ==============================================================================
# MENU UTAMA
# ==============================================================================
while true; do
    load_config
    echo -e "\n${CYAN}=============================================${NC}"
    echo -e "${CYAN}   GITHUB API AUTO UPLOADER (VPS BASH)       ${NC}"
    echo -e "${CYAN}=============================================${NC}"
    if [[ -n "$GITHUB_USER" ]]; then
        echo -e "Status Akun : ${GREEN}$GITHUB_USER (Token Aktif)${NC}"
    else
        echo -e "Status Akun : ${RED}Belum Login / Token Belum Diatur${NC}"
    fi
    echo -e "---------------------------------------------"
    echo "1. Set Token GitHub"
    echo "2. List Repository (Public & Private)"
    echo "3. Create Repository (Public / Private)"
    echo "4. Upload File / Folder ke GitHub"
    echo "5. Create File Langsung di GitHub"
    echo "6. Keluar"
    echo -e "---------------------------------------------"
    read -rp "Pilih menu [1-6]: " choice

    case "$choice" in
        1) set_github_token ;;
        2) list_repositories_menu ;;
        3) create_repository ;;
        4) upload_to_github ;;
        5) create_file_on_github ;;
        6) echo "Keluar."; exit 0 ;;
        *) echo -e "${RED}[!] Pilihan tidak valid.${NC}" ;;
    esac
done
