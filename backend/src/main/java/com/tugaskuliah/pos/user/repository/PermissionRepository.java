package com.tugaskuliah.pos.user.repository;

import com.tugaskuliah.pos.user.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Set;

public interface PermissionRepository extends JpaRepository<Permission, Long> {

    List<Permission> findAllByOrderByGroupNameAscCodeAsc();

    Set<Permission> findByCodeIn(Set<String> codes);
}
