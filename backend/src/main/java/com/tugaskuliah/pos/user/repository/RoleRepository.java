package com.tugaskuliah.pos.user.repository;

import com.tugaskuliah.pos.user.entity.Role;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByName(String name);

    Set<Role> findByNameIn(Set<String> names);

    @EntityGraph(attributePaths = {"permissions"})
    @Query("select r from Role r")
    List<Role> findAllWithPermissions();
}
