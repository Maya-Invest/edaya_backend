# Import format adapter

`src/` implements the core CSV/XLSX parsing and report ports. It bounds file size, ZIP expansion, worksheets, rows, columns and cells before returning raw values. It contains no matching, authorization or school workflows. `tests/` qualifies malformed input, round trips and expansion limits.
